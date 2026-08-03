import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createRepositories } from './repositories.js';
import { initializeDatabase } from './client.js';
import { PrismaTransactionManager } from './transaction.js';

const SHA256 = 'b'.repeat(64);
const packageRoot = resolve(import.meta.dirname, '..');
const databaseFileName = `repository-test-${process.pid}.db`;
const databasePath = resolve(packageRoot, 'prisma', databaseFileName);
const databaseUrl = `file:./${databaseFileName}`;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const repositories = createRepositories(prisma);

beforeAll(async () => {
  writeFileSync(databasePath, '', { flag: 'wx' });
  execFileSync(
    process.execPath,
    [
      resolve(packageRoot, '../../node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      resolve(packageRoot, 'prisma/schema.prisma'),
    ],
    {
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    },
  );
  await initializeDatabase(prisma);
}, 30_000);

afterAll(async () => {
  await prisma.$disconnect();
  rmSync(databasePath, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  rmSync(`${databasePath}-wal`, { force: true });
});

describe('database repositories', () => {
  it('rolls back all repositories bound to a failed transaction', async () => {
    const manager = new PrismaTransactionManager(prisma);
    const countBefore = await prisma.project.count();

    await expect(
      manager.run(async (transactionRepositories) => {
        await transactionRepositories.projects.create({ name: 'Rolled back project' });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    await expect(prisma.project.count()).resolves.toBe(countBefore);
  });

  it('creates and reads validated projects and proteins', async () => {
    const project = await repositories.projects.create({ name: 'Demo project' });
    const protein = await repositories.proteins.create({
      projectId: project.id,
      originalFasta: '>demo\nACDEFGHIK',
      header: 'demo',
      normalizedSequence: 'ACDEFGHIK',
      sequenceLength: 9,
      sha256: SHA256,
      validationProfileVersion: 'mvp-v1.0',
    });

    await expect(repositories.projects.findById(project.id)).resolves.toMatchObject({
      name: 'Demo project',
    });
    await expect(repositories.proteins.listByProject(project.id)).resolves.toEqual([protein]);
    await expect(repositories.proteins.findCurrentByProject(project.id)).resolves.toEqual(protein);
  });

  it('deletes only demo projects whose retention window has expired', async () => {
    const now = new Date('2026-08-03T12:00:00.000Z');
    const expiredDemo = await repositories.projects.create({
      name: 'Expired judge demo',
      isDemo: true,
      demoExpiresAt: new Date('2026-08-03T11:59:59.000Z'),
    });
    const activeDemo = await repositories.projects.create({
      name: 'Active judge demo',
      isDemo: true,
      demoExpiresAt: new Date('2026-08-04T12:00:00.000Z'),
    });
    const researchProject = await repositories.projects.create({
      name: 'Persistent research project',
      isDemo: false,
      demoExpiresAt: new Date('2026-08-03T11:59:59.000Z'),
    });

    await expect(repositories.projects.deleteExpiredDemoProjects(now)).resolves.toBe(1);
    await expect(repositories.projects.findById(expiredDemo.id)).resolves.toBeNull();
    await expect(repositories.projects.findById(activeDemo.id)).resolves.not.toBeNull();
    await expect(repositories.projects.findById(researchProject.id)).resolves.not.toBeNull();
  });

  it('pages projects, counts the complete workspace, and allocates revisions', async () => {
    await repositories.projects.create({ name: 'Second paged project' });
    const page = await repositories.projects.listPage({ limit: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).not.toBeNull();
    await expect(repositories.projects.countAll()).resolves.toBeGreaterThanOrEqual(2);
    await expect(repositories.runs.nextRevision(page.items[0]!.id)).resolves.toBeGreaterThanOrEqual(
      1,
    );
  });

  it('persists only profile metadata in a run configuration snapshot', async () => {
    const project = await repositories.projects.create({ name: 'Snapshot project' });
    const protein = await repositories.proteins.create({
      projectId: project.id,
      originalFasta: '>snapshot\nACDEFGHIK',
      header: 'snapshot',
      normalizedSequence: 'ACDEFGHIK',
      sequenceLength: 9,
      sha256: 'c'.repeat(64),
      validationProfileVersion: 'mvp-v1.0',
    });
    const configurationJson = JSON.stringify({
      profiles: {
        biologicalConstraints: {
          name: 'biological-constraints',
          version: 'mvp-v1.0',
          hash: 'd'.repeat(64),
        },
        ranking: { name: 'ranking', version: 'mvp-v1.0', hash: 'e'.repeat(64) },
      },
    });

    const run = await repositories.runs.create({
      projectId: project.id,
      proteinInputId: protein.id,
      revision: 1,
      status: 'DRAFT',
      configurationJson,
      configurationHash: 'f'.repeat(64),
      ruleProfileVersion: 'mvp-v1.0',
      rankingProfileVersion: 'mvp-v1.0',
    });

    expect(run.configurationJson).toBe(configurationJson);
    expect(() =>
      repositories.runs.updateControl(run.id, {
        configurationJson,
      } as never),
    ).toThrow();
  });

  it('rejects observations attached to failed predictor executions', async () => {
    const run = await prisma.workflowRun.findFirstOrThrow({
      where: { project: { name: 'Snapshot project' } },
    });
    const stage = await repositories.stages.create({
      runId: run.id,
      stageKey: 'prediction',
      attempt: 1,
      status: 'FAILED',
      dependencyKeysJson: '[]',
      inputHash: '1'.repeat(64),
    });
    const candidate = await repositories.candidates.create({
      runId: run.id,
      candidateKey: 'MHCI:1:9:HLA-A*02:01',
      candidateType: 'MHCI',
      peptide: 'ACDEFGHIK',
      start: 1,
      end: 9,
      length: 9,
      allele: 'HLA-A*02:01',
    });
    const execution = await repositories.predictorExecutions.create({
      runId: run.id,
      stageId: stage.id,
      connectorId: 'iedb',
      connectorVersion: '1',
      method: 'mhci',
      methodVersion: '1',
      status: 'FAILED',
      sourceStatus: 'FAILED',
      parametersJson: '{}',
      inputHash: '2'.repeat(64),
      attemptCount: 1,
      errorCode: 'UPSTREAM_FAILED',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    await expect(
      repositories.observations.create({
        runId: run.id,
        candidateId: candidate.id,
        predictorExecutionId: execution.id,
        rawScoresJson: '{}',
        unitsJson: '{}',
        inputHash: '3'.repeat(64),
        outputHash: '4'.repeat(64),
        observedAt: new Date(),
      }),
    ).rejects.toThrow('FAILED predictor executions');
  });

  it('compares run transitions and appends ordered replayable events', async () => {
    const run = await prisma.workflowRun.findFirstOrThrow({
      where: { project: { name: 'Snapshot project' } },
    });

    await expect(
      repositories.runs.transitionControl(run.id, ['QUEUED'], { status: 'RUNNING' }),
    ).resolves.toBeNull();
    await expect(
      repositories.runs.transitionControl(run.id, ['DRAFT'], { status: 'QUEUED' }),
    ).resolves.toMatchObject({ status: 'QUEUED' });

    const first = await repositories.events.appendNext({
      runId: run.id,
      eventType: 'run.status_changed',
      level: 'INFO',
      message: 'Queued',
      payloadJson: '{"status":"QUEUED"}',
    });
    const second = await repositories.events.appendNext({
      runId: run.id,
      eventType: 'run.status_changed',
      level: 'INFO',
      message: 'Running',
      payloadJson: '{"status":"RUNNING"}',
    });
    const page = await repositories.events.listPage({
      runId: run.id,
      afterSequence: first.sequenceNumber,
      limit: 10,
    });

    expect([first.sequenceNumber, second.sequenceNumber]).toEqual([1, 2]);
    expect(page).toMatchObject({ items: [{ sequenceNumber: 2 }], nextSequence: null });
  });

  it('retrieves run-scoped ranking snapshots and candidate records', async () => {
    const run = await prisma.workflowRun.findFirstOrThrow({
      where: { project: { name: 'Snapshot project' } },
    });
    const candidate = await repositories.candidates.create({
      runId: run.id,
      candidateKey: 'MHCI:2:10:HLA-A*02:01',
      candidateType: 'MHCI',
      peptide: 'CDEFGHIKL',
      start: 2,
      end: 10,
      length: 9,
      allele: 'HLA-A*02:01',
    });
    const snapshotHash = '8'.repeat(64);
    await repositories.rankingResults.create({
      runId: run.id,
      candidateId: candidate.id,
      snapshotHash,
      profileVersion: 'mvp-v1.0',
      track: 'MHCI',
      componentScoresJson: '{"binding":0.8}',
      penaltiesJson: '{}',
      finalScore: 0.8,
      category: 'RECOMMENDED',
      confidence: 0.9,
      rank: 1,
    });

    await expect(repositories.rankingResults.findLatestSnapshotHash(run.id)).resolves.toBe(
      snapshotHash,
    );
    const page = await repositories.candidates.listRanked({
      runId: run.id,
      rankingSnapshotHash: snapshotHash,
      sort: 'rank',
      limit: 10,
    });
    expect(page.items).toHaveLength(1);
    await expect(
      repositories.candidates.findDetail(run.id, candidate.id, snapshotHash),
    ).resolves.toMatchObject({ ranking: { candidateId: candidate.id } });
  });

  it('does not expose update or delete operations for append-only repositories', () => {
    expect('update' in repositories.observations).toBe(false);
    expect('delete' in repositories.observations).toBe(false);
    expect('update' in repositories.events).toBe(false);
    expect('delete' in repositories.approvals).toBe(false);
  });
});

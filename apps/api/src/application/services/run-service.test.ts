import { describe, expect, it, vi } from 'vitest';

import type { RunConfiguration } from '@immunograph/shared';

import { UnavailableWorkflowExecutionPort, type WorkflowExecutionPort } from '../ports.js';
import { RunService } from './run-service.js';

const projectId = '00000000-0000-4000-8000-000000000001';
const proteinId = '00000000-0000-4000-8000-000000000002';
const runId = '00000000-0000-4000-8000-000000000003';
const now = new Date('2026-07-24T00:00:00.000Z');

const configuration = {
  analysis: {
    mhci: {
      enabled: true,
      alleles: ['HLA-A*02:01'],
      peptideLengths: [9],
      methods: ['iedb-recommended'],
    },
    mhcii: { enabled: false, alleles: [], peptideLengths: [], methods: [] },
    bcell: { enabled: false, methods: [] },
  },
  populations: ['INDIA'],
  fallbackPolicy: 'CACHE_THEN_LIVE',
  ruleProfileVersion: 'mvp-v1.0',
  rankingProfileVersion: 'mvp-v1.0',
  outputPreferences: {
    formats: ['JSON'],
    templateVersion: 'v1',
    includeWorkflowTrace: false,
    includeEvidenceGraph: false,
  },
} satisfies RunConfiguration;

function fixture(port: WorkflowExecutionPort = new UnavailableWorkflowExecutionPort()) {
  let run: Record<string, unknown> | null = null;
  const events: Record<string, unknown>[] = [];
  const approvals: Record<string, unknown>[] = [];
  const repositories = {
    projects: { findById: async () => ({ id: projectId }) },
    proteins: { findCurrentByProject: async () => ({ id: proteinId, projectId }) },
    runs: {
      nextRevision: async () => 1,
      create: async (input: Record<string, unknown>) => {
        run = {
          id: runId,
          ...input,
          quality: null,
          replayHash: null,
          failureCode: null,
          createdAt: now,
          startedAt: null,
          completedAt: null,
          updatedAt: now,
        };
        return run;
      },
      findById: async () => run,
      findDetailById: async () =>
        run === null
          ? null
          : { ...run, approvals, predictorExecutions: [], rankingResults: [], stages: [] },
      transitionControl: async (
        _id: string,
        statuses: string[],
        update: Record<string, unknown>,
      ) => {
        if (run === null || !statuses.includes(String(run.status))) return null;
        run = { ...run, ...update, updatedAt: now };
        return run;
      },
    },
    approvals: {
      create: async (input: Record<string, unknown>) => {
        const value = { id: `approval-${approvals.length}`, ...input, createdAt: now };
        approvals.push(value);
        return value;
      },
    },
    events: {
      appendNext: async (input: Record<string, unknown>) => {
        const value = {
          id: `event-${events.length}`,
          ...input,
          sequenceNumber: events.length + 1,
          stageId: null,
          createdAt: now,
        };
        events.push(value);
        return value;
      },
    },
    stages: { findLatestByKey: async () => null, create: async () => null },
    rankingResults: { findSnapshot: async () => [] },
    candidates: { findById: async () => null },
  };
  const transactions = {
    run: async <T>(work: (value: typeof repositories) => Promise<T>) => work(repositories),
  };
  const eventService = {
    append: async (repos: typeof repositories, input: Record<string, unknown>) =>
      repos.events.appendNext({ ...input, payloadJson: JSON.stringify(input.data) }),
    publish: vi.fn(),
  };
  return {
    currentRun: () => run,
    approvals,
    events,
    service: new RunService(
      repositories as never,
      transactions as never,
      eventService as never,
      port as never,
      undefined,
      () => now,
    ),
  };
}

describe('RunService', () => {
  it('creates a draft with immutable profile metadata and a canonical hash', async () => {
    const { service, currentRun } = fixture();
    const result = await service.create({ projectId, ...configuration });
    expect(result).toMatchObject({
      id: runId,
      status: 'DRAFT',
      approvalRequirements: ['CONFIGURATION'],
    });
    expect(currentRun()?.configurationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(String(currentRun()?.configurationJson)).not.toContain('tCell');
  });

  it('fails closed for an unapproved profile version', async () => {
    const { service } = fixture();
    await expect(
      service.create({ projectId, ...configuration, rankingProfileVersion: 'demo-v1' }),
    ).rejects.toMatchObject({ code: 'PROFILE_NOT_FOUND', statusCode: 422 });
  });

  it('atomically approves the current configuration and queues the run', async () => {
    const { service, approvals, events } = fixture();
    const draft = await service.create({ projectId, ...configuration });
    const queued = await service.approveConfiguration({
      runId,
      decision: 'APPROVE',
      expectedConfigurationHash: draft.configurationHash,
    });
    expect(queued.status).toBe('QUEUED');
    expect(approvals).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it('returns 503 without mutating an approved queued run when workflow execution is absent', async () => {
    const { service, currentRun } = fixture();
    const draft = await service.create({ projectId, ...configuration });
    await service.approveConfiguration({
      runId,
      decision: 'APPROVE',
      expectedConfigurationHash: draft.configurationHash,
    });
    await expect(service.start({ runId }, { requestId: 'request-id' })).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
    });
    expect(currentRun()?.status).toBe('QUEUED');
  });
});

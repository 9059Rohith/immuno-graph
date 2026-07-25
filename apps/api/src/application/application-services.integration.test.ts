import { createHash } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  artifactListSchema,
  candidateComparisonSchema,
  candidateDetailSchema,
  candidateListSchema,
  connectorHealthListSchema,
  connectorListSchema,
  createdProjectSchema,
  graphSchema,
  profileListSchema,
  projectDetailSchema,
  projectListSchema,
  reportJobSchema,
  runDetailSchema,
  runtimeSettingsSchema,
  sequenceMapSchema,
} from '@immunograph/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createApiApplication } from '../application.js';
import type { ApiEnvironment } from '../config/environment.js';
import type {
  ConnectorDiagnosticsPort,
  ReportGenerationPort,
  WorkflowExecutionPort,
} from './ports.js';
import { createServices } from './create-services.js';
import { createMigratedTestDatabase } from './test-context.test-support.js';

const reportJobId = '00000000-0000-4000-8000-000000000901';
const rankingHash = '9'.repeat(64);
const workflow: WorkflowExecutionPort = {
  assertAvailable: vi.fn().mockResolvedValue(undefined),
  start: vi.fn().mockResolvedValue(undefined),
  cancel: vi.fn().mockResolvedValue(undefined),
  retry: vi.fn().mockResolvedValue(undefined),
};
const reports: ReportGenerationPort = {
  assertAvailable: vi.fn().mockResolvedValue(undefined),
  generate: vi.fn().mockResolvedValue({ artifactJobId: reportJobId, status: 'QUEUED' }),
};
const connectors: ConnectorDiagnosticsPort = {
  list: vi.fn().mockResolvedValue([
    {
      connectorId: 'graphbepi',
      displayName: 'GraphBepi',
      methods: ['b-cell'],
      liveSupported: false,
      fixtureOnly: true,
      licenseStatus: 'APPROVED',
    },
  ]),
  health: vi.fn().mockResolvedValue([
    {
      connectorId: 'graphbepi',
      health: 'DEGRADED',
      sourceStatus: 'FIXTURE',
      checkedAt: '2026-07-24T00:00:00.000Z',
      message: 'Fixture-only for MVP.',
    },
  ]),
};

const runConfiguration = {
  analysis: {
    mhci: {
      enabled: true,
      alleles: ['HLA-A*02:01'],
      peptideLengths: [9],
      methods: ['iedb-recommended'],
    },
    mhcii: { enabled: false, alleles: [], peptideLengths: [], methods: [] },
    bcell: { enabled: true, methods: ['graphbepi'] },
  },
  populations: ['INDIA'],
  fallbackPolicy: 'CACHE_THEN_LIVE_THEN_FIXTURE',
  ruleProfileVersion: 'mvp-v1.0',
  rankingProfileVersion: 'mvp-v1.0',
  outputPreferences: {
    formats: ['JSON', 'CSV'],
    templateVersion: 'research-report-v1',
    includeWorkflowTrace: true,
    includeEvidenceGraph: true,
  },
};

let context!: Awaited<ReturnType<typeof createMigratedTestDatabase>>;
let artifactRoot: string;
let app!: ReturnType<typeof createApiApplication>;

const environment = (): ApiEnvironment => ({
  API_HOST: '127.0.0.1',
  API_LOG_LEVEL: 'silent',
  API_PORT: 3000,
  APPLICATION_VERSION: '0.1.0',
  ARTIFACT_ROOT: artifactRoot,
  DATABASE_URL: context.databaseUrl,
  DEMO_MODE: true,
  LLM_ENABLED: false,
  NODE_ENV: 'test',
  SPECIFICATION_VERSION: '0.7.0-draft',
});

function data(response: { json(): unknown }) {
  return (response.json() as { data: unknown }).data;
}

beforeAll(async () => {
  context = await createMigratedTestDatabase();
  artifactRoot = join(tmpdir(), `immunograph-artifacts-${process.pid}-${Date.now()}`);
  await mkdir(artifactRoot, { recursive: false });
  const services = createServices(context.client, environment(), { workflow, reports, connectors });
  app = createApiApplication(environment(), services);
}, 60_000);

afterAll(async () => {
  await app?.close();
  await context?.cleanup();
  if (artifactRoot !== undefined) {
    await rm(artifactRoot, { force: true, recursive: true });
  }
});

describe('real REST application services with SQLite', () => {
  it('persists project and run lifecycle operations through unchanged contracts', async () => {
    const createdResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { 'idempotency-key': 'create-project' },
      payload: {
        name: 'Dengue envelope shortlist',
        organism: 'Dengue virus',
        proteinName: 'Envelope protein',
        description: 'Application service integration',
        fasta: '>dengue-envelope\nMRCIGISNRD',
      },
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdProjectSchema.parse(data(createdResponse));

    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/projects?limit=20' });
    expect(projectListSchema.parse(data(listResponse)).items).toHaveLength(1);
    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${created.project.id}`,
    });
    expect(projectDetailSchema.parse(data(detailResponse)).project.id).toBe(created.project.id);

    const runResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${created.project.id}/runs`,
      headers: { 'idempotency-key': 'create-run' },
      payload: runConfiguration,
    });
    expect(runResponse.statusCode).toBe(201);
    const draft = runDetailSchema.parse(data(runResponse));
    expect(draft.status).toBe('DRAFT');

    const approvalResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runs/${draft.id}/approvals/configuration`,
      headers: { 'idempotency-key': 'approve-config' },
      payload: { decision: 'APPROVE', expectedConfigurationHash: draft.configurationHash },
    });
    expect(runDetailSchema.parse(data(approvalResponse)).status).toBe('QUEUED');
    const startResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runs/${draft.id}/start`,
      payload: {},
    });
    expect(runDetailSchema.parse(data(startResponse)).status).toBe('RUNNING');
    expect(workflow.start).toHaveBeenCalledWith(
      expect.objectContaining({ runId: draft.id, requestId: expect.any(String) }),
    );

    const history = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${draft.id}/events/history?limit=50`,
    });
    expect((data(history) as { items: unknown[] }).items).toHaveLength(2);

    await seedCandidateResults(draft.id);
    const candidatesResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${draft.id}/candidates?sort=rank&limit=50`,
    });
    const candidates = candidateListSchema.parse(data(candidatesResponse));
    expect(candidates.items).toHaveLength(2);
    const firstId = candidates.items[0]!.id;
    const secondId = candidates.items[1]!.id;

    const candidateResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${draft.id}/candidates/${firstId}`,
    });
    expect(candidateDetailSchema.parse(data(candidateResponse)).candidate.id).toBe(firstId);
    const comparisonResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runs/${draft.id}/candidates/compare`,
      headers: { 'idempotency-key': 'compare' },
      payload: { candidateIds: [firstId, secondId] },
    });
    expect(candidateComparisonSchema.parse(data(comparisonResponse)).candidates).toHaveLength(2);

    const evidenceResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${draft.id}/evidence-graph?depth=2`,
    });
    const evidenceGraph = graphSchema.parse(data(evidenceResponse));
    expect(evidenceGraph.nodes.length).toBeGreaterThanOrEqual(5);
    expect(evidenceGraph.edges.length).toBeGreaterThanOrEqual(4);
    const workflowResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${draft.id}/workflow-graph`,
    });
    graphSchema.parse(data(workflowResponse));
    const sequenceResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${draft.id}/visualizations/sequence-map`,
    });
    expect(sequenceMapSchema.parse(data(sequenceResponse)).segments).toHaveLength(2);

    await context.client.workflowRun.update({
      where: { id: draft.id },
      data: { status: 'AWAITING_SHORTLIST_APPROVAL' },
    });
    const shortlistResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runs/${draft.id}/approvals/shortlist`,
      headers: { 'idempotency-key': 'approve-shortlist' },
      payload: {
        decision: 'APPROVE',
        expectedRankingSnapshotHash: rankingHash,
        approvedCandidateIds: [firstId],
        excludedCandidateIds: [secondId],
        note: 'Computational evidence acknowledged.',
      },
    });
    expect(runDetailSchema.parse(data(shortlistResponse)).status).toBe('COMPLETED');

    const reportResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/runs/${draft.id}/reports`,
      headers: { 'idempotency-key': 'create-report' },
      payload: runConfiguration.outputPreferences,
    });
    expect(reportJobSchema.parse(data(reportResponse)).artifactJobId).toBe(reportJobId);

    const artifact = await seedArtifact(draft.id);
    const artifactsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${draft.id}/artifacts`,
    });
    expect(artifactListSchema.parse(data(artifactsResponse)).items).toHaveLength(1);
    const downloadResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/artifacts/${artifact.id}/download`,
    });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.body).toBe('{"verified":true}');

    const eventStream = createServices(context.client, environment(), {
      workflow,
      reports,
      connectors,
    }).streamRunEvents({ runId: draft.id, lastEventId: '0' }, { requestId: 'stream' });
    const replayed = [];
    for await (const event of eventStream) replayed.push(event);
    expect(replayed.map(({ id }) => id)).toEqual(['1', '2', '3']);
  }, 30_000);

  it('exposes safe diagnostics and fails closed when no exact fixture is available', async () => {
    const connectorList = await app.inject({ method: 'GET', url: '/api/v1/connectors' });
    expect(connectorListSchema.parse(data(connectorList)).items[0]?.fixtureOnly).toBe(true);
    const connectorHealth = await app.inject({ method: 'GET', url: '/api/v1/connectors/health' });
    connectorHealthListSchema.parse(data(connectorHealth));
    const profiles = await app.inject({ method: 'GET', url: '/api/v1/settings/profiles' });
    expect(profileListSchema.parse(data(profiles)).items).toHaveLength(2);
    const runtime = await app.inject({ method: 'GET', url: '/api/v1/settings/runtime' });
    expect(runtimeSettingsSchema.parse(data(runtime))).not.toHaveProperty('databaseUrl');

    const created = createdProjectSchema.parse(
      data(
        await app.inject({
          method: 'POST',
          url: '/api/v1/projects',
          headers: { 'idempotency-key': 'unavailable-project' },
          payload: {
            name: 'Unavailable port check',
            organism: 'Fixture',
            proteinName: 'Protein',
            fasta: '>fixture\nACDEFGHIK',
          },
        }),
      ),
    );
    const unavailableApp = createApiApplication(
      environment(),
      createServices(context.client, environment()),
    );
    const draft = runDetailSchema.parse(
      data(
        await unavailableApp.inject({
          method: 'POST',
          url: `/api/v1/projects/${created.project.id}/runs`,
          headers: { 'idempotency-key': 'unavailable-run' },
          payload: runConfiguration,
        }),
      ),
    );
    await unavailableApp.inject({
      method: 'POST',
      url: `/api/v1/runs/${draft.id}/approvals/configuration`,
      headers: { 'idempotency-key': 'unavailable-approve' },
      payload: { decision: 'APPROVE', expectedConfigurationHash: draft.configurationHash },
    });
    const unavailableStart = await unavailableApp.inject({
      method: 'POST',
      url: `/api/v1/runs/${draft.id}/start`,
      payload: {},
    });
    expect(unavailableStart.statusCode).toBe(503);
    expect(
      (await context.client.workflowRun.findUniqueOrThrow({ where: { id: draft.id } })).status,
    ).toBe('FAILED');
    await unavailableApp.close();
  });
});

async function seedCandidateResults(runId: string) {
  const firstId = '00000000-0000-4000-8000-000000000911';
  const secondId = '00000000-0000-4000-8000-000000000912';
  await context.client.candidate.createMany({
    data: [
      {
        id: firstId,
        runId,
        candidateKey: `protein|MHCI|1|9|MRCIGISNR|HLA-A*02:01`,
        candidateType: 'MHCI',
        peptide: 'MRCIGISNR',
        start: 1,
        end: 9,
        length: 9,
        allele: 'HLA-A*02:01',
      },
      {
        id: secondId,
        runId,
        candidateKey: `protein|MHCI|2|10|RCIGISNRD|HLA-A*02:01`,
        candidateType: 'MHCI',
        peptide: 'RCIGISNRD',
        start: 2,
        end: 10,
        length: 9,
        allele: 'HLA-A*02:01',
      },
    ],
  });
  await context.client.rankingResult.createMany({
    data: [firstId, secondId].map((candidateId, index) => ({
      runId,
      candidateId,
      snapshotHash: rankingHash,
      profileVersion: 'mvp-v1.0',
      track: 'MHCI',
      componentScoresJson: JSON.stringify({ binding: 0.9 - index * 0.1 }),
      penaltiesJson: '{}',
      finalScore: 0.9 - index * 0.1,
      category: 'RECOMMENDED',
      confidence: 0.85,
      rank: index + 1,
    })),
  });
}

async function seedArtifact(runId: string) {
  const relativePath = join(runId, 'report.json');
  const absoluteDirectory = join(artifactRoot, runId);
  const body = '{"verified":true}';
  await mkdir(absoluteDirectory);
  await writeFile(join(artifactRoot, relativePath), body);
  return context.client.artifact.create({
    data: {
      runId,
      type: 'JSON',
      format: 'JSON',
      relativePath,
      mimeType: 'application/json',
      byteSize: Buffer.byteLength(body),
      sha256: createHash('sha256').update(body).digest('hex'),
      templateVersion: 'research-report-v1',
    },
  });
}

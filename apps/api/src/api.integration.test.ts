import { Readable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

import { createApiApplication } from './application.js';
import type { ApiEnvironment } from './config/environment.js';

const environment: ApiEnvironment = {
  API_HOST: '127.0.0.1',
  API_LOG_LEVEL: 'silent',
  API_PORT: 3000,
  APPLICATION_VERSION: '0.1.0',
  ARTIFACT_ROOT: './artifacts',
  DATABASE_URL: 'file:./unused.db',
  DEMO_MODE: true,
  LLM_ENABLED: false,
  NODE_ENV: 'test',
  SPECIFICATION_VERSION: '0.7.0-draft',
};

const projectId = '00000000-0000-4000-8000-000000000001';
const runId = '00000000-0000-4000-8000-000000000002';
const candidateId = '00000000-0000-4000-8000-000000000003';
const artifactId = '00000000-0000-4000-8000-000000000004';
const hash = 'a'.repeat(64);
const outputPreferences = {
  formats: ['JSON', 'CSV'] as const,
  templateVersion: 'research-report-v1',
  includeWorkflowTrace: true,
  includeEvidenceGraph: true,
};

function services() {
  return {
    execute: vi.fn(async (operation: string, input: unknown) => ({ operation, input })),
    async *streamRunEvents(input: unknown) {
      yield {
        id: '42',
        event: 'stage.status_changed' as const,
        data: { runId, stageKey: 'predict_mhci', status: 'SUCCEEDED' },
      };
      void input;
    },
    downloadArtifact: vi.fn(async () => ({
      stream: Readable.from(['artifact-body']),
      filename: 'report.json',
      mediaType: 'application/json',
      contentLength: 13,
    })),
  };
}

const projectBody = {
  name: 'Dengue envelope shortlist',
  organism: 'Dengue virus',
  proteinName: 'Envelope protein',
  description: 'Hackathon demonstration',
  fasta: '>dengue-envelope\nMRCIGISNRD',
};

const runBody = {
  analysis: {
    mhci: {
      enabled: true,
      alleles: ['HLA-A*02:01'],
      peptideLengths: [9, 10],
      methods: ['iedb-recommended'],
    },
    mhcii: {
      enabled: true,
      alleles: ['HLA-DRB1*04:01'],
      peptideLengths: [15],
      methods: ['iedb-recommended'],
    },
    bcell: { enabled: true, methods: ['graphbepi'] },
  },
  populations: ['INDIA'],
  fallbackPolicy: 'CACHE_THEN_LIVE_THEN_FIXTURE',
  ruleProfileVersion: 'demo-v1',
  rankingProfileVersion: 'demo-v1',
  outputPreferences,
};

describe('REST API', () => {
  it('exposes a lightweight live health probe without invoking application services', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);

    const response = await app.inject({ method: 'GET', url: '/health/live' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(gateway.execute).not.toHaveBeenCalled();
    await app.close();
  }, 15_000);

  it('starts a credential-free judge demo and rejects non-empty input', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);

    const started = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/start',
      payload: {},
    });
    const rejected = await app.inject({
      method: 'POST',
      url: '/api/v1/demo/start',
      payload: { fixtureId: 'custom' },
    });

    expect(started.statusCode).toBe(201);
    expect(gateway.execute).toHaveBeenCalledWith(
      'demo.start',
      {},
      expect.objectContaining({ requestId: expect.any(String) }),
    );
    expect(rejected.statusCode).toBe(400);
    expect(gateway.execute).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('registers every documented endpoint and delegates regular requests', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);
    const cases = [
      { method: 'POST', url: '/api/v1/projects', payload: projectBody, status: 201 },
      { method: 'GET', url: '/api/v1/projects?limit=20', status: 200 },
      { method: 'GET', url: `/api/v1/projects/${projectId}`, status: 200 },
      {
        method: 'DELETE',
        url: `/api/v1/projects/${projectId}`,
        payload: { confirmation: 'DELETE', expectedProjectName: projectBody.name },
        status: 200,
      },
      { method: 'POST', url: `/api/v1/projects/${projectId}/runs`, payload: runBody, status: 201 },
      { method: 'GET', url: `/api/v1/runs/${runId}`, status: 200 },
      {
        method: 'POST',
        url: `/api/v1/runs/${runId}/approvals/configuration`,
        payload: { decision: 'APPROVE', expectedConfigurationHash: hash, note: 'Reviewed' },
        status: 200,
      },
      { method: 'POST', url: `/api/v1/runs/${runId}/start`, payload: {}, status: 202 },
      { method: 'POST', url: `/api/v1/runs/${runId}/cancel`, payload: {}, status: 202 },
      {
        method: 'POST',
        url: `/api/v1/runs/${runId}/stages/predict_mhci/retry`,
        payload: { expectedAttempt: 1 },
        status: 202,
      },
      { method: 'GET', url: `/api/v1/runs/${runId}/events/history?limit=50`, status: 200 },
      {
        method: 'GET',
        url: `/api/v1/runs/${runId}/candidates?track=MHCI&search=LLFGYPVYV&hasWarnings=false&sort=rank&limit=50`,
        status: 200,
      },
      { method: 'GET', url: `/api/v1/runs/${runId}/candidates/${candidateId}`, status: 200 },
      {
        method: 'POST',
        url: `/api/v1/runs/${runId}/candidates/compare`,
        payload: { candidateIds: [candidateId, projectId] },
        status: 200,
      },
      {
        method: 'GET',
        url: `/api/v1/runs/${runId}/population-coverage?populationId=INDIA&purpose=CANDIDATE_RANKING&candidateId=${candidateId}`,
        status: 200,
      },
      {
        method: 'GET',
        url: `/api/v1/runs/${runId}/shortlist-optimization?track=MHCI`,
        status: 200,
      },
      {
        method: 'POST',
        url: `/api/v1/runs/${runId}/approvals/shortlist`,
        payload: {
          decision: 'APPROVE',
          expectedRankingSnapshotHash: hash,
          approvedCandidateIds: [candidateId],
          excludedCandidateIds: [],
          note: 'Reviewed',
        },
        status: 200,
      },
      { method: 'GET', url: `/api/v1/runs/${runId}/evidence-graph?depth=2`, status: 200 },
      { method: 'GET', url: `/api/v1/runs/${runId}/workflow-graph`, status: 200 },
      {
        method: 'GET',
        url: `/api/v1/runs/${runId}/visualizations/sequence-map`,
        status: 200,
      },
      { method: 'GET', url: '/api/v1/connectors', status: 200 },
      { method: 'GET', url: '/api/v1/connectors/health', status: 200 },
      {
        method: 'POST',
        url: `/api/v1/runs/${runId}/candidates/${candidateId}/explanation`,
        payload: { mode: 'DETERMINISTIC', audience: 'RESEARCHER' },
        status: 200,
      },
      {
        method: 'POST',
        url: `/api/v1/runs/${runId}/reports`,
        payload: {
          formats: ['JSON', 'CSV'],
          templateVersion: 'research-report-v1',
          includeWorkflowTrace: true,
          includeEvidenceGraph: true,
        },
        status: 202,
      },
      { method: 'GET', url: `/api/v1/runs/${runId}/artifacts`, status: 200 },
      { method: 'GET', url: '/api/v1/settings/profiles', status: 200 },
      { method: 'GET', url: '/api/v1/settings/runtime', status: 200 },
    ] as const;

    for (const [index, request] of cases.entries()) {
      const response = await app.inject({
        ...request,
        headers: { 'idempotency-key': `case-${index}` },
      });
      expect(response.statusCode, `${request.method} ${request.url}`).toBe(request.status);
      expect(response.json()).toMatchObject({ requestId: expect.any(String) });
    }
    expect(gateway.execute).toHaveBeenCalledTimes(cases.length);
    expect(gateway.execute).toHaveBeenCalledWith(
      'candidates.list',
      expect.objectContaining({ search: 'LLFGYPVYV', hasWarnings: false }),
      expect.objectContaining({ requestId: expect.any(String) }),
    );
    await app.close();
  });

  it('rejects malformed candidate filters without invoking the service', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);
    const invalidBoolean = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${runId}/candidates?hasWarnings=not-a-boolean`,
    });
    const oversizedSearch = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${runId}/candidates?search=${'A'.repeat(201)}`,
    });

    expect(invalidBoolean.statusCode).toBe(400);
    expect(oversizedSearch.statusCode).toBe(400);
    expect(gateway.execute).not.toHaveBeenCalled();
    await app.close();
  });

  it('rejects malformed output preferences', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);
    const duplicateFormats = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/runs`,
      payload: {
        ...runBody,
        outputPreferences: { ...outputPreferences, formats: ['JSON', 'JSON'] },
      },
    });
    const emptyFormats = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/runs`,
      payload: { ...runBody, outputPreferences: { ...outputPreferences, formats: [] } },
    });
    const unknownFormat = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/runs`,
      payload: { ...runBody, outputPreferences: { ...outputPreferences, formats: ['PDF'] } },
    });

    expect(duplicateFormats.statusCode).toBe(400);
    expect(emptyFormats.statusCode).toBe(400);
    expect(unknownFormat.statusCode).toBe(400);
    expect(gateway.execute).not.toHaveBeenCalled();
    await app.close();
  });

  it('preserves portfolio and safe runtime response contracts', async () => {
    const portfolioSummary = {
      projectCount: 3,
      runCounts: { total: 8, running: 1, completed: 6, failed: 1 },
      candidateCount: 412,
      reportCount: 5,
      recentSince: '2026-06-24T00:00:00.000Z',
      recentRunCount: 4,
      asOf: '2026-07-24T12:00:00.000Z',
    };
    const runtime = {
      demoMode: true,
      llmEnabled: false,
      databaseStatus: 'AVAILABLE',
      artifactPathStatus: 'AVAILABLE',
      fixtureManifest: { version: 'mvp-v1.0', sha256: hash, entries: [] },
      build: {
        applicationVersion: '0.1.0',
        specificationVersion: '0.6.0-draft',
        commitSha: null,
        builtAt: null,
      },
    };
    const gateway = {
      ...services(),
      execute: vi.fn(async (operation: string) => {
        if (operation === 'projects.list') {
          return { items: [], nextCursor: null, portfolioSummary };
        }
        if (operation === 'settings.runtime') return runtime;
        return {};
      }),
    };
    const app = createApiApplication(environment, gateway);

    const projects = await app.inject({ method: 'GET', url: '/api/v1/projects' });
    const settings = await app.inject({ method: 'GET', url: '/api/v1/settings/runtime' });

    expect(projects.json()).toEqual({
      requestId: expect.any(String),
      data: { items: [], nextCursor: null, portfolioSummary },
    });
    expect(settings.json()).toEqual({ requestId: expect.any(String), data: runtime });
    await app.close();
  });

  it('rejects invalid and unknown fields with a stable Zod error envelope', async () => {
    const app = createApiApplication(environment, services());
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { ...projectBody, conservation: true },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      requestId: expect.any(String),
      error: { code: 'VALIDATION_ERROR', retryable: false, fieldErrors: expect.any(Object) },
    });
    await app.close();
  });

  it('rejects GraphBepi configurations whose fallback policy cannot use fixtures', async () => {
    const app = createApiApplication(environment, services());
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${projectId}/runs`,
      payload: { ...runBody, fallbackPolicy: 'LIVE_ONLY' },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      error: { code: 'GRAPHBEPI_REQUIRES_FIXTURE_POLICY', retryable: false },
    });
    await app.close();
  });

  it('maps oversized FASTA input and malformed JSON to documented client errors', async () => {
    const app = createApiApplication(environment, services());
    const oversized = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { ...projectBody, fasta: `>protein\n${'A'.repeat(1_048_577)}` },
    });
    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { 'content-type': 'application/json' },
      payload: '{"name":',
    });

    expect(oversized.statusCode).toBe(413);
    expect(oversized.json()).toMatchObject({ error: { code: 'SEQUENCE_TOO_LONG' } });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toMatchObject({ error: { code: 'MALFORMED_JSON' } });
    await app.close();
  });

  it('replays idempotent commands without invoking the service twice', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);
    const request = {
      method: 'POST' as const,
      url: `/api/v1/runs/${runId}/start`,
      payload: {},
    };

    const first = await app.inject(request);
    const second = await app.inject(request);

    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    expect(first.json().data).toEqual(second.json().data);
    expect(gateway.execute).toHaveBeenCalledTimes(1);
    await app.close();
  });

  it('maps shared service failures without exposing stack traces', async () => {
    const gateway = services();
    gateway.execute.mockRejectedValueOnce(
      Object.assign(new Error('The run does not exist.'), {
        code: 'RUN_NOT_FOUND',
        statusCode: 404,
        retryable: false,
      }),
    );
    const app = createApiApplication(environment, gateway);
    const response = await app.inject({ method: 'GET', url: `/api/v1/runs/${runId}` });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      requestId: expect.any(String),
      error: { code: 'RUN_NOT_FOUND', message: 'The run does not exist.', retryable: false },
    });
    expect(response.body).not.toContain('Error:');
    await app.close();
  });

  it('streams resumable workflow events as SSE', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/runs/${runId}/events`,
      headers: { 'last-event-id': '41' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.body).toContain('id: 42');
    expect(response.body).toContain('event: stage.status_changed');
    await app.close();
  });

  it('passes a client-disconnect signal to the SSE service', async () => {
    let suppliedSignal: AbortSignal | undefined;
    const gateway = {
      ...services(),
      async *streamRunEvents(input: { signal?: AbortSignal }) {
        suppliedSignal = input.signal;
        yield {
          id: '42',
          event: 'run.status_changed' as const,
          data: { runId, status: 'RUNNING' },
        };
      },
    };
    const app = createApiApplication(environment, gateway);
    const response = await app.inject({ method: 'GET', url: `/api/v1/runs/${runId}/events` });

    expect(response.statusCode).toBe(200);
    expect(suppliedSignal).toBeInstanceOf(AbortSignal);
    await app.close();
  });

  it('streams service-resolved artifacts with safe response headers', async () => {
    const gateway = services();
    const app = createApiApplication(environment, gateway);
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/artifacts/${artifactId}/download`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.headers['content-disposition']).toBe('attachment; filename="report.json"');
    expect(response.body).toBe('artifact-body');
    expect(gateway.downloadArtifact).toHaveBeenCalledOnce();
    await app.close();
  });
});

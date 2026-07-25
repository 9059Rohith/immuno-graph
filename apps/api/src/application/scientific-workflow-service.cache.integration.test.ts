import { createHash, randomUUID } from 'node:crypto';

import { validateFasta } from '@immunograph/algorithms';
import { loadProfileVersion } from '@immunograph/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { normalizeRunConfiguration, serializeRunConfiguration } from './json.js';
import type { McpToolGateway, McpToolResult } from './mcp-tool-gateway.js';
import { buildBindingCacheKey } from './prediction-cache.js';
import { ScientificWorkflowService } from './scientific-workflow-service.js';
import type { scientificBindingDataSchema } from './scientific-workflow-contracts.js';
import { createMigratedTestDatabase } from './test-context.test-support.js';
import { UnavailableWorkflowExecutionPort } from './ports.js';

type BindingResult = z.infer<typeof scientificBindingDataSchema>;

const fasta = '>cache-test\nACDEFGHIKLMNPQRSTVWY';
const validatedFasta = (() => {
  const result = validateFasta(fasta);
  if (!result.ok) throw new Error('Invalid test FASTA.');
  return result.value;
})();

const liveBindingResult: BindingResult = {
  observations: [
    {
      observationId: 'obs-live-1',
      candidateRef: 'candidate-live-1',
      candidateType: 'MHCI',
      peptide: 'ACDEFGHIK',
      start: 1,
      end: 9,
      length: 9,
      allele: 'HLA-A*02:01',
      method: 'iedb-recommended',
      methodVersion: '2023.09',
      rawScore: 0.8,
      percentileRank: 0.5,
      rawFields: { parser: 'redacted-test-sample' },
    },
  ],
  provenance: [
    {
      connectorId: 'iedb',
      connectorVersion: 'tools-api-v1',
      method: 'iedb-recommended',
      methodVersion: '2023.09',
      status: 'LIVE',
      sourceUri: 'https://tools-cluster-interface.iedb.org/tools_api/mhci/',
      parameters: { candidateType: 'MHCI', redacted: true },
      predictionSource: 'LIVE',
      scientificUse: true,
      validationStatus: 'SCIENTIFIC',
    },
  ],
};

const runConfiguration = normalizeRunConfiguration({
  requestedExecutionMode: 'AUTO',
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
  populations: [],
  fallbackPolicy: 'CACHE_THEN_LIVE',
  ruleProfileVersion: 'mvp-v1.0',
  rankingProfileVersion: 'mvp-v1.0',
  outputPreferences: {
    formats: ['JSON', 'CSV'],
    templateVersion: 'research-report-v1',
    includeWorkflowTrace: true,
    includeEvidenceGraph: true,
  },
});

let database!: Awaited<ReturnType<typeof createMigratedTestDatabase>>;

beforeAll(async () => {
  database = await createMigratedTestDatabase();
}, 60_000);

afterAll(async () => {
  await database?.cleanup();
});

describe('scientific workflow prediction cache', () => {
  it('caches successful live binding results and reuses them as CACHED on an exact repeat', async () => {
    const firstRunId = await createRunningRun();
    const firstGateway = createGateway(liveBindingResult);
    const clock = fixedClock();
    const firstWorkflow = new ScientificWorkflowService(
      database.repositories,
      database.transactionManager,
      firstGateway.gateway,
      new UnavailableWorkflowExecutionPort(),
      true,
      clock,
    );

    await firstWorkflow.start({ runId: firstRunId, requestId: 'cache-write' });

    const cacheKey = buildBindingCacheKey({
      proteinHash: validatedFasta.sha256,
      candidateType: 'MHCI',
      alleles: runConfiguration.analysis.mhci.alleles,
      peptideLengths: runConfiguration.analysis.mhci.peptideLengths,
      methods: runConfiguration.analysis.mhci.methods,
      ruleProfileVersion: runConfiguration.ruleProfileVersion,
      rankingProfileVersion: runConfiguration.rankingProfileVersion,
    });
    const cached = await database.repositories.cacheEntries.findReusable(cacheKey, clock());
    expect(cached?.schemaVersion).toBe('scientific-binding-cache-v1');
    expect(firstGateway.calls.filter((tool) => tool === 'predict_mhci')).toHaveLength(1);

    const secondRunId = await createRunningRun();
    const secondGateway = createGateway(liveBindingResult, { failLivePrediction: true });
    const secondWorkflow = new ScientificWorkflowService(
      database.repositories,
      database.transactionManager,
      secondGateway.gateway,
      new UnavailableWorkflowExecutionPort(),
      true,
      clock,
    );

    await secondWorkflow.start({ runId: secondRunId, requestId: 'cache-read' });

    expect(secondGateway.calls).not.toContain('predict_mhci');
    const executions = await database.repositories.predictorExecutions.listByRun(secondRunId);
    expect(executions.map(({ sourceStatus }) => sourceStatus)).toContain('CACHED');
  }, 30_000);
});

async function createRunningRun(): Promise<string> {
  const project = await database.repositories.projects.create({
    name: `Cache workflow ${randomUUID()}`,
    organism: 'Synthetic organism',
    proteinName: 'Synthetic protein',
  });
  const protein = await database.repositories.proteins.create({
    projectId: project.id,
    originalFasta: fasta,
    header: validatedFasta.header,
    normalizedSequence: validatedFasta.normalizedSequence,
    sequenceLength: validatedFasta.sequenceLength,
    sha256: validatedFasta.sha256,
    validationProfileVersion: 'mvp-v1.0',
  });
  const [biologicalConstraints, ranking] = await Promise.all([
    loadProfileVersion('biologicalConstraints', 'mvp-v1.0'),
    loadProfileVersion('ranking', 'mvp-v1.0'),
  ]);
  const snapshot = {
    request: runConfiguration,
    profiles: {
      biologicalConstraints: biologicalConstraints.metadata,
      ranking: ranking.metadata,
    },
  };
  const configurationJson = serializeRunConfiguration(snapshot);
  const run = await database.repositories.runs.create({
    projectId: project.id,
    proteinInputId: protein.id,
    revision: 1,
    status: 'RUNNING',
    configurationJson,
    configurationHash: sha256(configurationJson),
    ruleProfileVersion: runConfiguration.ruleProfileVersion,
    rankingProfileVersion: runConfiguration.rankingProfileVersion,
    requestedExecutionMode: runConfiguration.requestedExecutionMode,
    startedAt: fixedClock()(),
  });
  return run.id;
}

function createGateway(
  bindingResult: BindingResult,
  options: { failLivePrediction?: boolean } = {},
): { gateway: McpToolGateway; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    gateway: {
      assertAvailable: async () => undefined,
      call: async <T>(toolName: string, input: unknown, schema: z.ZodType<T>) => {
        calls.push(toolName);
        if (toolName === 'predict_mhci' && options.failLivePrediction === true) {
          throw new Error('Live prediction should not be called on cache hit.');
        }
        return toolResult(toolName, schema.parse(resolveToolData(toolName, input, bindingResult)));
      },
    },
  };
}

function resolveToolData(toolName: string, input: unknown, bindingResult: BindingResult): unknown {
  switch (toolName) {
    case 'validate_sequence':
      return {
        normalizedSequence: validatedFasta.normalizedSequence,
        header: validatedFasta.header,
        sequenceLength: validatedFasta.sequenceLength,
        sha256: validatedFasta.sha256,
        warnings: [],
      };
    case 'predict_mhci':
      return bindingResult;
    case 'normalize_scores':
      return {
        values: bindingResult.observations.map((observation) => ({
          observationId: observation.observationId,
          normalizedScore: 0.995,
          transformation: { kind: 'INVERSE_PERCENTILE', cap: 100 },
        })),
      };
    case 'compute_consensus_batch':
      return {
        groups: parseGroups(input).map((group) => ({
          groupKey: group.groupKey,
          weightedMean: 0.995,
          weightedVariance: 0,
          agreement: 1,
          agreementStatus: 'SUFFICIENT_OBSERVATIONS',
          completeness: 1,
          consensus: 0.995,
        })),
      };
    case 'validate_thresholds':
      return {
        ruleProfileVersion: 'mvp-v1.0',
        results: parseCandidates(input).map(({ candidateId }) => ({
          candidateId,
          passesAllHardConstraints: true,
          outcomes: [
            {
              ruleId: 'BINDING-001',
              ruleVersion: 'mvp-v1.0',
              severity: 'HARD',
              outcome: 'PASS',
              evidenceRefs: ['obs-live-1'],
              message: 'Binding evidence passes the configured threshold.',
            },
          ],
        })),
      };
    case 'apply_constraint_rules':
      return {
        snapshotHash: parseSnapshotHash(input),
        ruleProfileVersion: 'mvp-v1.0',
        constraintResults: [],
        duplicateLinks: [],
        retainedCandidateIds: parseOverlapCandidates(input).map(({ id }) => id),
        overlapRejections: [],
        eligibleCandidateIds: parseOverlapCandidates(input).map(({ id }) => id),
      };
    case 'rank_candidates':
      return rankCandidates(input);
    default:
      throw new Error(`Unexpected tool call ${toolName}.`);
  }
}

function rankCandidates(input: unknown) {
  const parsed = input as {
    phase: 'PRELIMINARY' | 'FINAL';
    candidates: Array<{
      candidateId: string;
      candidateKey: string;
      candidateType: 'MHCI';
      agreement: number;
      completeness: number;
      start: number;
      blockingReviewCondition: boolean;
      ruleOutcomes: unknown[];
    }>;
  };
  const candidates = parsed.candidates.map((candidate, index) => ({
    candidateId: candidate.candidateId,
    ...(parsed.phase === 'FINAL'
      ? {
          candidateKey: candidate.candidateKey,
          candidateType: candidate.candidateType,
          agreement: candidate.agreement,
          completeness: candidate.completeness,
          start: candidate.start,
          blockingReviewCondition: candidate.blockingReviewCondition,
          ruleOutcomes: candidate.ruleOutcomes,
          category: 'RECOMMENDED',
          confidence: 'HIGH',
          confidenceScore: 0.95,
          trackRank: index + 1,
          categoryRank: index + 1,
        }
      : {}),
    componentScores: { binding: 0.995, consensus: 0.995, populationCoverage: 0, completeness: 1 },
    scoreBeforePenalty: 0.895,
    missingEvidencePenalty: 0,
    softWarningPenalty: 0,
    fixturePenalty: 0,
    finalScore: 0.895,
  }));
  return { phase: parsed.phase, candidates };
}

function parseGroups(input: unknown): Array<{ groupKey: string }> {
  return (input as { groups: Array<{ groupKey: string }> }).groups;
}

function parseCandidates(input: unknown): Array<{ candidateId: string }> {
  return (input as { candidates: Array<{ candidateId: string }> }).candidates;
}

function parseOverlapCandidates(input: unknown): Array<{ id: string }> {
  return (input as { overlapCandidates: Array<{ id: string }> }).overlapCandidates;
}

function parseSnapshotHash(input: unknown): string {
  return (input as { snapshotHash: string }).snapshotHash;
}

function toolResult<T>(toolName: string, data: T): McpToolResult<T> {
  return {
    data,
    meta: {
      requestId: 'test-request',
      runId: 'test-run',
      toolName,
      toolVersion: 'test',
      startedAt: fixedClock()().toISOString(),
      completedAt: fixedClock()().toISOString(),
      durationMs: 1,
      inputHash: '1'.repeat(64),
      outputHash: '2'.repeat(64),
    },
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function fixedClock() {
  return () => new Date('2026-07-25T00:00:00.000Z');
}

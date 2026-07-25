import { createHash } from 'node:crypto';

import {
  biologicalConstraintProfileSchema,
  loadProfileVersion,
  type Repositories,
  type TransactionManager,
} from '@immunograph/database';
import type { ExecutionMode, SourceStatus } from '@immunograph/shared';
import { z } from 'zod';

import { DependencyUnavailableError } from './errors.js';
import {
  deriveExecutionMode,
  isFallbackEligible,
  resolveExecutionPlan,
  type EvidenceSource,
} from './execution-policy.js';
import type { McpToolGateway, McpToolResult } from './mcp-tool-gateway.js';
import { parseStoredRunConfiguration } from './json.js';
import type { WorkflowExecutionPort } from './ports.js';
import {
  BINDING_CACHE_SCHEMA_VERSION,
  buildBindingCacheKey,
  cacheableLiveBindingResult,
  cachedBindingResult,
  type ScientificBindingResult,
} from './prediction-cache.js';
import {
  appliedConstraintsDataSchema,
  bcellPredictionDataSchema,
  consensusBatchDataSchema,
  finalRankingDataSchema,
  generatedCandidatesDataSchema,
  normalizedScoresDataSchema,
  preliminaryRankingDataSchema,
  scientificBindingDataSchema,
  scientificCoverageDataSchema,
  shortlistOptimizationDataSchema,
  syntheticBindingDataSchema,
  syntheticCoverageDataSchema,
  thresholdValidationDataSchema,
  validateSequenceDataSchema,
  type ConnectorProvenance,
  type RuleOutcome,
} from './scientific-workflow-contracts.js';
import { WORKFLOW_STAGE_DEFINITIONS } from './workflow-definition.js';

const SYNTHETIC_DISCLOSURE =
  'Generated using deterministic offline demonstration predictors. These values are not validated biological predictions and must not be used for scientific or clinical interpretation.';
const BINDING_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIRED_MCP_WORKFLOW_TOOLS = [
  'validate_sequence',
  'generate_candidate_peptides',
  'normalize_scores',
  'compute_consensus_batch',
  'validate_thresholds',
  'apply_constraint_rules',
  'rank_candidates',
  'optimize_shortlist_coverage',
] as const;

interface WorkingObservation {
  id: string;
  rawScore: number;
  percentileRank?: number;
  normalizedScore: number;
  method: string;
  methodVersion: string;
  rawFields: Record<string, unknown>;
  provenance: ConnectorProvenance;
}

interface WorkingCoverage {
  populationId: string;
  projectedCoverage: number;
  averageHits: number;
  provenance: ConnectorProvenance;
}

interface WorkingCandidate {
  ref: string;
  key: string;
  candidateType: 'MHCI' | 'MHCII' | 'BCELL';
  peptide: string;
  start: number;
  end: number;
  length: number;
  allele?: string;
  observations: WorkingObservation[];
  bindingQuality: number;
  weightedMean: number;
  variance: number;
  agreement: number;
  completeness: number;
  consensus: number;
  coverage: WorkingCoverage[];
  candidateCoverage: number;
  ruleOutcomes: RuleOutcome[];
  passesHardConstraints: boolean;
  preliminaryScore: number;
}

interface PipelineResult {
  candidates: WorkingCandidate[];
  rankings: z.infer<typeof finalRankingDataSchema>['candidates'];
  shortlistOptimizations: WorkingShortlistOptimization[];
  snapshotHash: string;
  sourceStatuses: SourceStatus[];
  executionMode: ExecutionMode;
  toolResults: Array<McpToolResult<unknown>>;
}

interface WorkingShortlistOptimization {
  track: 'MHCI' | 'MHCII';
  eligibleCandidateIds: string[];
  selectedCandidateIds: string[];
  finalCoverage: number;
  coverageByPopulation: Record<string, number>;
  algorithmId: string;
  algorithmVersion: string;
  steps: Array<{
    step: number;
    candidateId: string;
    marginalCoverageGain: number;
    cumulativeCoverage: number;
    reasonCode: string;
  }>;
  provenance: ConnectorProvenance & {
    constructSequence?: string;
    averageCandidateScore?: number;
    redundancyPenalty?: number;
    objectiveScore?: number;
    confidence?: unknown;
    manufacturability?: unknown;
  };
}

type StoredConfiguration = ReturnType<typeof parseStoredRunConfiguration>['request'];
type ConstraintProfile = z.infer<typeof biologicalConstraintProfileSchema>;

export class ScientificWorkflowService implements WorkflowExecutionPort {
  constructor(
    private readonly repositories: Repositories,
    private readonly transactions: TransactionManager,
    private readonly gateway: McpToolGateway,
    private readonly fixtureFallback: WorkflowExecutionPort,
    private readonly demoMode: boolean,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  assertAvailable(): Promise<void> {
    // The application service remains available even if MCP is offline because an exact
    // approved fixture can still be replayed by the local emergency fallback.
    return Promise.resolve();
  }

  async start(command: { runId: string; requestId: string }): Promise<void> {
    const run = await this.repositories.runs.findById(command.runId);
    if (run === null) throw new DependencyUnavailableError('workflow run');
    const protein = await this.repositories.proteins.findById(run.proteinInputId);
    if (protein === null) throw new DependencyUnavailableError('workflow protein');
    const configuration = parseStoredRunConfiguration(run.configurationJson).request;
    const plan = resolveExecutionPlan(
      configuration.requestedExecutionMode ?? 'AUTO',
      configuration.fallbackPolicy,
      this.demoMode,
    );
    if (plan.length === 0) throw new DependencyUnavailableError('selected execution mode');

    let lastFailure: unknown;
    let effectivePlan = plan;
    if (plan.some((source) => source !== 'FIXTURE')) {
      try {
        await this.gateway.assertAvailable(REQUIRED_MCP_WORKFLOW_TOOLS);
      } catch (error) {
        lastFailure = error;
        if (!isFallbackEligible(error)) throw error;
        effectivePlan = plan.filter((source) => source === 'FIXTURE');
        if (effectivePlan.length === 0) throw error;
      }
    }
    for (const source of effectivePlan) {
      if (source === 'FIXTURE') {
        try {
          await this.fixtureFallback.start(command);
          return;
        } catch (fallbackError) {
          lastFailure = fallbackError;
        }
        continue;
      }
      try {
        const result = await this.executePipeline(source, command, protein, configuration);
        await this.persist(command, protein.sha256, configuration, result);
        return;
      } catch (error) {
        lastFailure = error;
        if (!isFallbackEligible(error)) throw error;
      }
    }
    if (lastFailure instanceof Error) throw lastFailure;
    throw new DependencyUnavailableError('scientific workflow');
  }

  cancel(): Promise<void> {
    return Promise.resolve();
  }

  retry(): Promise<void> {
    return Promise.reject(new DependencyUnavailableError('inline scientific stage retry'));
  }

  private async executePipeline(
    source: EvidenceSource,
    command: { runId: string; requestId: string },
    protein: { originalFasta: string; normalizedSequence: string; sha256: string },
    configuration: StoredConfiguration,
  ): Promise<PipelineResult> {
    const context = { requestId: command.requestId, runId: command.runId };
    const toolResults: Array<McpToolResult<unknown>> = [];
    const call = async <T>(
      name: string,
      input: unknown,
      schema: z.ZodType<T>,
    ): Promise<McpToolResult<T>> => {
      const result = await this.gateway.call(name, input, schema, context);
      toolResults.push(result as McpToolResult<unknown>);
      return result;
    };

    await this.gateway.assertAvailable(REQUIRED_MCP_WORKFLOW_TOOLS);
    const validated = await call(
      'validate_sequence',
      { fasta: protein.originalFasta, profileVersion: 'mvp-v1.0' },
      validateSequenceDataSchema,
    );
    if (validated.data.sha256 !== protein.sha256) {
      throw new Error('The persisted protein does not match MCP FASTA validation.');
    }
    const loadedProfile = await loadProfileVersion(
      'biologicalConstraints',
      configuration.ruleProfileVersion,
    );
    const constraintProfile = biologicalConstraintProfileSchema.parse(loadedProfile.definition);

    const candidates = await this.acquireCandidates(
      source,
      command,
      validated.data.normalizedSequence,
      protein.sha256,
      configuration,
      call,
    );
    if (candidates.length === 0) throw new DependencyUnavailableError('prediction candidates');

    const normalized = await call(
      'normalize_scores',
      {
        runId: command.runId,
        registryVersion: 'mvp-v1.0',
        observations: candidates.flatMap((candidate) =>
          candidate.observations.map((observation) => {
            const usePercentile = observation.percentileRank !== undefined;
            return {
              observationId: observation.id,
              rawScore: usePercentile ? observation.percentileRank : observation.rawScore,
              profile: usePercentile
                ? { kind: 'INVERSE_PERCENTILE', cap: 100 }
                : { kind: 'IDENTITY', min: 0, max: 1, direction: 'HIGHER_BETTER' },
            };
          }),
        ),
      },
      normalizedScoresDataSchema,
    );
    const normalizedById = new Map(
      normalized.data.values.map((value) => [value.observationId, value.normalizedScore]),
    );
    for (const candidate of candidates) {
      for (const observation of candidate.observations) {
        observation.normalizedScore = normalizedById.get(observation.id) ?? 0;
      }
    }

    const consensus = await call(
      'compute_consensus_batch',
      {
        runId: command.runId,
        groups: candidates.map((candidate) => ({
          groupKey: candidate.ref,
          configuredRequiredWeight: candidate.observations.length,
          observations: candidate.observations.map((observation) => ({
            observationId: observation.id,
            normalizedScore: observation.normalizedScore,
            reliabilityWeight: 1,
            required: true,
          })),
        })),
      },
      consensusBatchDataSchema,
    );
    const consensusByRef = new Map(consensus.data.groups.map((group) => [group.groupKey, group]));
    for (const candidate of candidates) {
      const summary = consensusByRef.get(candidate.ref);
      if (summary === undefined) throw new Error(`Consensus missing for ${candidate.ref}.`);
      candidate.bindingQuality = summary.weightedMean;
      candidate.weightedMean = summary.weightedMean;
      candidate.variance = summary.weightedVariance;
      candidate.agreement = summary.agreement;
      candidate.completeness = summary.completeness;
      candidate.consensus = summary.consensus;
    }

    await this.addCoverage(source, command, configuration, candidates, call);
    const thresholdInput = candidates.map((candidate) => ({
      candidateId: candidate.ref,
      candidateType: candidate.candidateType,
      peptideLength: candidate.length,
      ...(candidate.allele === undefined ? {} : { allele: candidate.allele }),
      allowedLengths: {
        MHCI: constraintProfile.mhci.peptideLengths,
        MHCII: constraintProfile.mhcii.peptideLengths,
      },
      supportedAlleles: [
        ...configuration.analysis.mhci.alleles,
        ...configuration.analysis.mhcii.alleles,
      ],
      requiredEvidenceRefs: candidate.observations.map(({ id }) => id),
      presentEvidenceRefs: candidate.observations.map(({ id }) => id),
      bindingObservations: candidate.observations.map((observation) => ({
        evidenceRef: observation.id,
        percentileRank: observation.percentileRank ?? (1 - observation.normalizedScore) * 100,
        required: true,
      })),
      bindingPercentileRankMaximum: constraintProfile.binding.percentileRankMaximum,
    }));
    const thresholds = await call(
      'validate_thresholds',
      {
        runId: command.runId,
        ruleProfileVersion: constraintProfile.version,
        candidates: thresholdInput,
      },
      thresholdValidationDataSchema,
    );
    const thresholdByRef = new Map(
      thresholds.data.results.map((result) => [result.candidateId, result]),
    );
    for (const candidate of candidates) {
      const result = thresholdByRef.get(candidate.ref);
      candidate.ruleOutcomes = result?.outcomes ?? [];
      candidate.passesHardConstraints = result?.passesAllHardConstraints ?? false;
    }

    const preliminary = await call(
      'rank_candidates',
      {
        runId: command.runId,
        phase: 'PRELIMINARY',
        rankingProfileVersion: configuration.rankingProfileVersion,
        baseConstraintsComplete: true,
        finalConstraintsComplete: false,
        candidates: candidates.map((candidate) => rankingInput(candidate, constraintProfile)),
      },
      preliminaryRankingDataSchema,
    );
    const preliminaryByRef = new Map(
      preliminary.data.candidates.map((candidate) => [candidate.candidateId, candidate.finalScore]),
    );
    for (const candidate of candidates) {
      candidate.preliminaryScore = preliminaryByRef.get(candidate.ref) ?? 0;
    }

    const snapshotHash = hashJson({
      configuration,
      candidates: candidates.map(candidateSnapshot),
      source,
    });
    const constraints = await call(
      'apply_constraint_rules',
      {
        runId: command.runId,
        snapshotHash,
        ruleProfileVersion: constraintProfile.version,
        baseConstraints: thresholdInput,
        duplicateCandidates: candidates.map((candidate) => ({
          id: candidate.ref,
          proteinHash: protein.sha256,
          candidateType: candidate.candidateType,
          start: candidate.start,
          end: candidate.end,
          peptide: candidate.peptide,
          ...(candidate.allele === undefined ? {} : { allele: candidate.allele }),
          observationRefs: candidate.observations.map(({ id }) => id),
        })),
        overlapCandidates: candidates.map((candidate) => ({
          id: candidate.ref,
          candidateKey: candidate.key,
          proteinHash: protein.sha256,
          candidateType: candidate.candidateType,
          ...(candidate.allele === undefined ? {} : { allele: candidate.allele }),
          peptide: candidate.peptide,
          start: candidate.start,
          end: candidate.end,
          length: candidate.length,
          passesHardConstraints: candidate.passesHardConstraints,
          preliminaryScore: candidate.preliminaryScore,
          completeness: candidate.completeness,
          agreement: candidate.agreement,
        })),
        overlapThreshold: constraintProfile.overlap.containmentMaximum,
      },
      appliedConstraintsDataSchema,
    );
    const rejectedForOverlap = new Map(
      constraints.data.overlapRejections.map((item) => [item.candidateId, item]),
    );
    for (const candidate of candidates) {
      const rejection = rejectedForOverlap.get(candidate.ref);
      if (rejection !== undefined) {
        candidate.ruleOutcomes.push({
          ruleId: rejection.ruleId,
          ruleVersion: constraintProfile.version,
          severity: 'HARD',
          outcome: 'FAIL',
          evidenceRefs: [rejection.retainedCandidateId],
          message: 'Candidate was removed by deterministic overlap resolution.',
        });
      }
    }
    const finalRanking = await call(
      'rank_candidates',
      {
        runId: command.runId,
        phase: 'FINAL',
        rankingProfileVersion: configuration.rankingProfileVersion,
        baseConstraintsComplete: true,
        finalConstraintsComplete: true,
        candidates: candidates.map((candidate) => rankingInput(candidate, constraintProfile)),
      },
      finalRankingDataSchema,
    );
    const shortlistOptimizations = await this.optimizeShortlists({
      command,
      configuration,
      candidates,
      finalRanking: finalRanking.data.candidates,
      snapshotHash,
      call,
    });
    const sourceStatuses = candidates.flatMap((candidate) =>
      candidate.observations.map((observation) => observation.provenance.status),
    );
    return {
      candidates,
      rankings: finalRanking.data.candidates,
      shortlistOptimizations,
      snapshotHash,
      sourceStatuses,
      executionMode: deriveExecutionMode(sourceStatuses),
      toolResults,
    };
  }

  private async optimizeShortlists(input: {
    command: { runId: string; requestId: string };
    configuration: StoredConfiguration;
    candidates: WorkingCandidate[];
    finalRanking: z.infer<typeof finalRankingDataSchema>['candidates'];
    snapshotHash: string;
    call: <T>(name: string, input: unknown, schema: z.ZodType<T>) => Promise<McpToolResult<T>>;
  }): Promise<WorkingShortlistOptimization[]> {
    if (input.configuration.populations.length === 0) return [];
    const rankingByRef = new Map(
      input.finalRanking.map((ranking) => [ranking.candidateId, ranking]),
    );
    const optimizations: WorkingShortlistOptimization[] = [];
    for (const track of ['MHCI', 'MHCII'] as const) {
      if (!trackEnabled(input.configuration, track)) continue;
      const eligible = input.candidates
        .filter((candidate) => candidate.candidateType === track)
        .filter((candidate) => {
          const ranking = rankingByRef.get(candidate.ref);
          return (
            ranking !== undefined &&
            ranking.category !== 'REJECTED' &&
            candidate.coverage.length > 0
          );
        })
        .sort((left, right) => {
          const leftRanking = rankingByRef.get(left.ref);
          const rightRanking = rankingByRef.get(right.ref);
          return (leftRanking?.trackRank ?? 0) - (rightRanking?.trackRank ?? 0);
        });
      if (eligible.length === 0) continue;
      const result = await input.call(
        'optimize_shortlist_coverage',
        {
          runId: input.command.runId,
          eligibleCandidateIds: eligible.map((candidate) => candidate.ref),
          finalRankingSnapshotHash: input.snapshotHash,
          populationIds: input.configuration.populations,
          targetCoverage: 0.8,
          maximumShortlistSize: 8,
          method: 'deterministic-genetic-construct-optimizer',
          candidates: eligible.map((candidate) => {
            const ranking = rankingByRef.get(candidate.ref);
            if (ranking === undefined) throw new Error(`Ranking missing for ${candidate.ref}.`);
            return {
              candidateId: candidate.ref,
              candidateType: track,
              peptide: candidate.peptide,
              start: candidate.start,
              end: candidate.end,
              rank: ranking.trackRank,
              finalScore: ranking.finalScore,
              agreement: ranking.agreement,
              completeness: ranking.completeness,
              category: ranking.category,
              populationCoverage: Object.fromEntries(
                candidate.coverage.map((coverage) => [
                  coverage.populationId,
                  coverage.projectedCoverage,
                ]),
              ),
            };
          }),
          populationWeights: Object.fromEntries(
            input.configuration.populations.map((populationId) => [populationId, 1]),
          ),
          linker: 'GPGPG',
        },
        shortlistOptimizationDataSchema,
      );
      optimizations.push({
        track,
        eligibleCandidateIds: eligible.map((candidate) => candidate.ref),
        selectedCandidateIds: result.data.selectedCandidateIds,
        finalCoverage: result.data.finalCoverage,
        coverageByPopulation: result.data.coverageByPopulation ?? {},
        algorithmId: result.data.provenance.algorithm ?? result.data.provenance.method,
        algorithmVersion:
          result.data.provenance.algorithmVersion ?? result.data.provenance.methodVersion,
        steps: result.data.steps.map((step, index) => ({
          step: index + 1,
          candidateId: step.candidateId,
          marginalCoverageGain: step.marginalGain,
          cumulativeCoverage: step.cumulativeCoverage,
          reasonCode: index === 0 ? 'GA_SEED_COVERAGE_ANCHOR' : 'GA_COVERAGE_REDUNDANCY_TRADEOFF',
        })),
        provenance: withDefinedOptimizationMetadata(
          result.data.provenance,
          optimizationMetadata(result.data),
        ),
      });
    }
    return optimizations;
  }

  private async acquireCandidates(
    source: EvidenceSource,
    command: { runId: string; requestId: string },
    sequence: string,
    proteinHash: string,
    configuration: StoredConfiguration,
    call: <T>(name: string, input: unknown, schema: z.ZodType<T>) => Promise<McpToolResult<T>>,
  ): Promise<WorkingCandidate[]> {
    const candidates: WorkingCandidate[] = [];
    for (const track of ['MHCI', 'MHCII'] as const) {
      const trackConfiguration = configuration.analysis[track.toLowerCase() as 'mhci' | 'mhcii'];
      if (!trackConfiguration.enabled) continue;
      if (source === 'SYNTHETIC') {
        const generated = await call(
          'generate_candidate_peptides',
          {
            runId: command.runId,
            sequence,
            sequenceHash: proteinHash,
            candidateType: track,
            peptideLengths: trackConfiguration.peptideLengths,
          },
          generatedCandidatesDataSchema,
        );
        const predicted = await call(
          'predict_synthetic_binding',
          {
            runId: command.runId,
            proteinHash,
            candidateType: track,
            candidates: generated.data.candidates,
            alleles: trackConfiguration.alleles,
            method: 'synthetic-binding',
            methodVersion: '1.0.0',
            datasetVersion: 'synthetic-v1',
          },
          syntheticBindingDataSchema,
        );
        for (const observation of predicted.data.observations) {
          candidates.push(
            createWorkingCandidate(
              {
                ...observation,
                ...(observation.allele === undefined ? {} : { allele: observation.allele }),
              },
              {
                id: observation.observationId,
                rawScore: observation.rawScore,
                percentileRank: observation.percentileRank,
                normalizedScore: observation.normalizedScore,
                method: observation.method,
                methodVersion: observation.methodVersion,
                rawFields: observation.rawFields,
                provenance: predicted.data.provenance,
              },
              proteinHash,
            ),
          );
        }
      } else {
        const cacheKey = buildBindingCacheKey({
          proteinHash,
          candidateType: track,
          alleles: trackConfiguration.alleles,
          peptideLengths: trackConfiguration.peptideLengths,
          methods: trackConfiguration.methods,
          ruleProfileVersion: configuration.ruleProfileVersion,
          rankingProfileVersion: configuration.rankingProfileVersion,
        });
        const fallbackPolicy =
          source === 'FIXTURE'
            ? 'FIXTURE_ONLY'
            : source === 'CACHE'
              ? 'CACHE_THEN_LIVE'
              : 'LIVE_ONLY';
        const predicted =
          source === 'CACHE'
            ? await this.readCachedBindingResult(cacheKey)
            : (
                await call(
                  track === 'MHCI' ? 'predict_mhci' : 'predict_mhcii',
                  {
                    runId: command.runId,
                    proteinRef: proteinHash,
                    sequence,
                    alleles: trackConfiguration.alleles,
                    peptideLengths: trackConfiguration.peptideLengths,
                    methods: trackConfiguration.methods,
                    fallbackPolicy,
                  },
                  scientificBindingDataSchema,
                )
              ).data;
        if (source === 'LIVE') await this.storeLiveBindingResult(cacheKey, predicted);
        for (const observation of predicted.observations) {
          const { allele, ...candidateFields } = observation;
          const provenance =
            predicted.provenance.find(
              (item) => item.method.toLowerCase() === observation.method.toLowerCase(),
            ) ?? predicted.provenance[0];
          if (provenance === undefined) throw new Error('Prediction provenance is missing.');
          candidates.push(
            createWorkingCandidate(
              {
                ...candidateFields,
                ...(allele === undefined ? {} : { allele }),
              },
              {
                id: observation.observationId,
                rawScore: observation.rawScore,
                ...(observation.percentileRank === undefined
                  ? {}
                  : { percentileRank: observation.percentileRank }),
                normalizedScore: 0,
                method: observation.method,
                methodVersion: observation.methodVersion,
                rawFields: observation.rawFields,
                provenance,
              },
              proteinHash,
            ),
          );
        }
      }
    }
    if (configuration.analysis.bcell.enabled) {
      const predicted = await call(
        'predict_bcell',
        {
          runId: command.runId,
          proteinRef: proteinHash,
          methods: configuration.analysis.bcell.methods,
          parameters: {},
          fallbackPolicy: 'FIXTURE_ONLY',
        },
        bcellPredictionDataSchema,
      );
      const provenance = predicted.data.provenance[0];
      if (provenance === undefined) throw new Error('GraphBepi fixture provenance is missing.');
      for (const [index, region] of predicted.data.regions.entries()) {
        const peptide = sequence.slice(region.start - 1, region.end);
        const ref = `bcell-${region.start}-${region.end}-${index + 1}`;
        candidates.push(
          createWorkingCandidate(
            {
              candidateRef: ref,
              candidateType: 'BCELL',
              peptide,
              start: region.start,
              end: region.end,
              length: region.end - region.start + 1,
            },
            {
              id: `${ref}-observation`,
              rawScore: region.score,
              normalizedScore: region.score,
              method: provenance.method,
              methodVersion: provenance.methodVersion,
              rawFields: predicted.data.rawMethodFields,
              provenance,
            },
            proteinHash,
          ),
        );
      }
    }
    return candidates;
  }

  private async readCachedBindingResult(cacheKey: string): Promise<ScientificBindingResult> {
    const entry = await this.repositories.cacheEntries.findReusable(cacheKey, this.clock());
    if (entry === null || entry.schemaVersion !== BINDING_CACHE_SCHEMA_VERSION) {
      throw new DependencyUnavailableError('prediction cache');
    }
    try {
      const stored = scientificBindingDataSchema.parse(JSON.parse(entry.valueJson));
      await this.repositories.cacheEntries.touch(entry.id, this.clock());
      return cachedBindingResult(stored, cacheKey);
    } catch {
      throw new DependencyUnavailableError('prediction cache');
    }
  }

  private async storeLiveBindingResult(
    cacheKey: string,
    result: ScientificBindingResult,
  ): Promise<void> {
    if (!cacheableLiveBindingResult(result)) return;
    const firstProvenance = result.provenance[0];
    if (firstProvenance === undefined) return;
    const now = this.clock();
    const existing = await this.repositories.cacheEntries.findReusable(cacheKey, now);
    if (existing !== null) {
      await this.repositories.cacheEntries.touch(existing.id, now);
      return;
    }
    try {
      await this.repositories.cacheEntries.create({
        cacheKey,
        connectorId: firstProvenance.connectorId,
        connectorVersion: firstProvenance.connectorVersion,
        method: firstProvenance.method,
        methodVersion: firstProvenance.methodVersion,
        inputHash: cacheKey,
        outputHash: hashJson(result),
        schemaVersion: BINDING_CACHE_SCHEMA_VERSION,
        valueJson: json(result),
        createdAt: now,
        expiresAt: new Date(now.getTime() + BINDING_CACHE_TTL_MS),
        lastAccessedAt: now,
      });
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code !== 'P2002') throw error;
      const raced = await this.repositories.cacheEntries.findReusable(cacheKey, now);
      if (raced !== null) await this.repositories.cacheEntries.touch(raced.id, now);
    }
  }

  private async addCoverage(
    source: EvidenceSource,
    command: { runId: string; requestId: string },
    configuration: StoredConfiguration,
    candidates: WorkingCandidate[],
    call: <T>(name: string, input: unknown, schema: z.ZodType<T>) => Promise<McpToolResult<T>>,
  ): Promise<void> {
    if (configuration.populations.length === 0) return;
    const byAllele = new Map<string, WorkingCandidate[]>();
    for (const candidate of candidates) {
      if (candidate.allele === undefined) continue;
      const existing = byAllele.get(candidate.allele) ?? [];
      existing.push(candidate);
      byAllele.set(candidate.allele, existing);
    }
    for (const [allele, alleleCandidates] of byAllele) {
      const classMode = alleleCandidates[0]?.candidateType === 'MHCI' ? 'CLASS_I' : 'CLASS_II';
      if (source === 'SYNTHETIC') {
        const result = await call(
          'calculate_synthetic_population_coverage',
          {
            runId: command.runId,
            associations: alleleCandidates.map((candidate) => ({
              candidateId: candidate.ref,
              peptide: candidate.peptide,
              allele,
            })),
            populationIds: configuration.populations,
            classMode,
          },
          syntheticCoverageDataSchema,
        );
        const coverage = result.data.populations.map((population) => ({
          populationId: population.populationId,
          projectedCoverage: population.projectedCoverage,
          averageHits: population.averageHits,
          provenance: result.data.provenance,
        }));
        for (const candidate of alleleCandidates) candidate.coverage = coverage;
      } else {
        const result = await call(
          'calculate_population_coverage',
          {
            runId: command.runId,
            associations: alleleCandidates.map((candidate) => ({
              candidateId: candidate.ref,
              peptide: candidate.peptide,
              allele,
            })),
            populationIds: configuration.populations,
            classMode,
            fallbackPolicy:
              source === 'FIXTURE'
                ? 'FIXTURE_ONLY'
                : source === 'CACHE'
                  ? 'CACHE_THEN_LIVE'
                  : 'LIVE_ONLY',
          },
          scientificCoverageDataSchema,
        );
        const averageHits = numericMetric(result.data.metrics.averageHits);
        const coverage = configuration.populations.map((populationId) => ({
          populationId,
          projectedCoverage: result.data.projectedCoverage,
          averageHits,
          provenance: result.data.provenance,
        }));
        for (const candidate of alleleCandidates) candidate.coverage = coverage;
      }
      for (const candidate of alleleCandidates) {
        candidate.candidateCoverage = average(
          candidate.coverage.map(({ projectedCoverage }) => projectedCoverage),
        );
      }
    }
  }

  private async persist(
    command: { runId: string; requestId: string },
    proteinHash: string,
    configuration: StoredConfiguration,
    result: PipelineResult,
  ): Promise<void> {
    const at = this.clock();
    await this.transactions.run(async (repositories) => {
      const stageByKey = new Map<string, { id: string }>();
      for (const definition of WORKFLOW_STAGE_DEFINITIONS) {
        const enabled =
          definition.track === undefined || trackEnabled(configuration, definition.track);
        const pending = definition.key === 'shortlist_approval';
        const stage = await repositories.stages.create({
          runId: command.runId,
          stageKey: definition.key,
          attempt: 1,
          status: pending ? 'PENDING' : enabled ? 'SUCCEEDED' : 'SKIPPED',
          dependencyKeysJson: json(definition.dependencies),
          inputHash: hashJson({ runId: command.runId, stageKey: definition.key, proteinHash }),
          ...(pending ? {} : { outputHash: result.snapshotHash }),
          progress: pending ? 0 : 1,
          ...(pending ? {} : { startedAt: at, completedAt: at }),
        });
        stageByKey.set(definition.key, stage);
      }

      const executionByKey = new Map<string, { id: string }>();
      for (const candidate of result.candidates) {
        for (const observation of candidate.observations) {
          const provenance = observation.provenance;
          const executionKey = [
            candidate.candidateType,
            provenance.connectorId,
            provenance.method,
            provenance.methodVersion,
            provenance.status,
          ].join('|');
          if (executionByKey.has(executionKey)) continue;
          const stageId = stageByKey.get(
            candidate.candidateType === 'MHCI'
              ? 'predict_mhci'
              : candidate.candidateType === 'MHCII'
                ? 'predict_mhcii'
                : 'predict_bcell',
          )!.id;
          const execution = await repositories.predictorExecutions.create({
            runId: command.runId,
            stageId,
            connectorId: provenance.connectorId,
            connectorVersion: provenance.connectorVersion,
            method: provenance.method,
            methodVersion: provenance.methodVersion,
            status: 'SUCCEEDED',
            sourceStatus: provenance.status,
            parametersJson: json({
              ...provenance.parameters,
              predictionSource: provenance.predictionSource ?? provenance.status,
              scientificUse: provenance.scientificUse ?? provenance.status === 'LIVE',
              validationStatus:
                provenance.validationStatus ??
                (provenance.status === 'SYNTHETIC'
                  ? 'DEMONSTRATION_ONLY'
                  : provenance.status === 'FIXTURE'
                    ? 'VERIFIED_FIXTURE'
                    : 'SCIENTIFIC'),
              algorithm: provenance.algorithm,
              algorithmVersion: provenance.algorithmVersion,
              datasetVersion: provenance.datasetVersion,
              datasetHash: provenance.datasetHash,
              disclosure:
                provenance.status === 'SYNTHETIC' || provenance.status === 'FIXTURE'
                  ? SYNTHETIC_DISCLOSURE
                  : undefined,
            }),
            inputHash: hashJson({ proteinHash, method: observation.method, configuration }),
            outputHash: hashJson({ executionKey, provenance }),
            ...(provenance.cacheKey === undefined ? {} : { cacheKey: provenance.cacheKey }),
            ...(provenance.fixtureId === undefined ? {} : { fixtureId: provenance.fixtureId }),
            attemptCount: 1,
            startedAt: at,
            completedAt: at,
          });
          executionByKey.set(executionKey, execution);
        }
      }

      const rankingByRef = new Map(
        result.rankings.map((ranking) => [ranking.candidateId, ranking]),
      );
      const candidateEntityByRef = new Map<string, { id: string }>();
      const observationEntityByRef = new Map<string, { id: string }>();
      const rankingEntityByRef = new Map<string, { id: string }>();
      for (const candidate of result.candidates) {
        const entity = await repositories.candidates.create({
          runId: command.runId,
          candidateKey: candidate.key,
          candidateType: candidate.candidateType,
          peptide: candidate.peptide,
          start: candidate.start,
          end: candidate.end,
          length: candidate.length,
          ...(candidate.allele === undefined ? {} : { allele: candidate.allele }),
        });
        candidateEntityByRef.set(candidate.ref, entity);
        for (const observation of candidate.observations) {
          const provenance = observation.provenance;
          const executionKey = [
            candidate.candidateType,
            provenance.connectorId,
            provenance.method,
            provenance.methodVersion,
            provenance.status,
          ].join('|');
          const observationEntity = await repositories.observations.create({
            runId: command.runId,
            candidateId: entity.id,
            predictorExecutionId: executionByKey.get(executionKey)!.id,
            rawScoresJson: json({
              value: observation.rawScore,
              percentileRank: observation.percentileRank,
              ...observation.rawFields,
            }),
            unitsJson: json({ rawScore: 'predictor_specific', percentileRank: 'percentile' }),
            inputHash: hashJson({ candidateKey: candidate.key, observationId: observation.id }),
            outputHash: hashJson(observation),
            observedAt: at,
          });
          observationEntityByRef.set(candidate.ref, observationEntity);
          await repositories.normalizedObservations.create({
            runId: command.runId,
            candidateId: entity.id,
            predictionObservationId: observationEntity.id,
            field: observation.percentileRank === undefined ? 'rawScore' : 'percentileRank',
            rawValue: observation.percentileRank ?? observation.rawScore,
            normalizedValue: observation.normalizedScore,
            profileVersion: 'mvp-v1.0',
            transformationJson: json(
              observation.percentileRank === undefined
                ? { kind: 'IDENTITY', min: 0, max: 1, direction: 'HIGHER_BETTER' }
                : { kind: 'INVERSE_PERCENTILE', cap: 100 },
            ),
          });
        }
        await repositories.evidenceSummaries.create({
          runId: command.runId,
          candidateId: entity.id,
          snapshotHash: result.snapshotHash,
          bindingQuality: candidate.bindingQuality,
          weightedMean: candidate.weightedMean,
          variance: candidate.variance,
          agreement: candidate.agreement,
          completeness: candidate.completeness,
          consensus: candidate.consensus,
          detailsJson: json({
            topReasons: [
              `${candidate.observations[0]?.method ?? 'Predictor'} evidence`,
              `${candidate.coverage.length} population coverage result(s)`,
            ],
            executionMode: result.executionMode,
            scientificUse: result.executionMode === 'LIVE',
            ...(result.executionMode === 'SYNTHETIC' || result.executionMode === 'HYBRID'
              ? { disclosure: SYNTHETIC_DISCLOSURE }
              : {}),
          }),
        });
        for (const outcome of candidate.ruleOutcomes) {
          await repositories.constraintOutcomes.create({
            runId: command.runId,
            candidateId: entity.id,
            snapshotHash: result.snapshotHash,
            ruleId: outcome.ruleId,
            ruleVersion: outcome.ruleVersion,
            severity: outcome.severity,
            outcome:
              outcome.outcome === 'WARN' || outcome.outcome === 'NOT_EVALUATED'
                ? 'REVIEW'
                : outcome.outcome,
            message: outcome.message,
            evidenceRefsJson: json(outcome.evidenceRefs),
          });
        }
        const ranking = rankingByRef.get(candidate.ref);
        if (ranking === undefined) throw new Error(`Ranking missing for ${candidate.ref}.`);
        const rankingEntity = await repositories.rankingResults.create({
          runId: command.runId,
          candidateId: entity.id,
          snapshotHash: result.snapshotHash,
          profileVersion: configuration.rankingProfileVersion,
          track: candidate.candidateType,
          componentScoresJson: json(ranking.componentScores),
          penaltiesJson: json({
            missingEvidencePenalty: ranking.missingEvidencePenalty,
            softWarningPenalty: ranking.softWarningPenalty,
            fixturePenalty: ranking.fixturePenalty,
          }),
          finalScore: ranking.finalScore,
          category: ranking.category,
          confidence: ranking.confidenceScore,
          rank: ranking.trackRank,
        });
        rankingEntityByRef.set(candidate.ref, rankingEntity);
        for (const coverage of candidate.coverage) {
          await repositories.populationCoverageResults.create({
            runId: command.runId,
            populationId: coverage.populationId,
            classMode: candidate.candidateType === 'MHCI' ? 'CLASS_I' : 'CLASS_II',
            purpose: 'CANDIDATE_RANKING',
            candidateIdsJson: json([entity.id]),
            projectedCoverage: coverage.projectedCoverage,
            averageHits: coverage.averageHits,
            provenanceJson: json(coverage.provenance),
            snapshotHash: result.snapshotHash,
          });
        }
      }

      for (const optimization of result.shortlistOptimizations) {
        const selectedCandidateIds = optimization.selectedCandidateIds.flatMap((ref) => {
          const entity = candidateEntityByRef.get(ref);
          return entity === undefined ? [] : [entity.id];
        });
        const eligibleCandidateIds = optimization.eligibleCandidateIds.flatMap((ref) => {
          const entity = candidateEntityByRef.get(ref);
          return entity === undefined ? [] : [entity.id];
        });
        const finalCoverageResult = await repositories.populationCoverageResults.create({
          runId: command.runId,
          populationId: 'weighted-population-average',
          classMode: optimization.track === 'MHCI' ? 'CLASS_I' : 'CLASS_II',
          purpose: 'FINAL_SHORTLIST',
          candidateIdsJson: json(selectedCandidateIds),
          projectedCoverage: optimization.finalCoverage,
          averageHits: selectedCandidateIds.length,
          provenanceJson: json({
            ...optimization.provenance,
            sourceStatus: optimization.provenance.status,
            method: optimization.provenance.method,
            coverageByPopulation: optimization.coverageByPopulation,
            selectedCandidateCount: selectedCandidateIds.length,
          }),
          snapshotHash: result.snapshotHash,
        });
        for (const [populationId, projectedCoverage] of Object.entries(
          optimization.coverageByPopulation,
        )) {
          await repositories.populationCoverageResults.create({
            runId: command.runId,
            populationId,
            classMode: optimization.track === 'MHCI' ? 'CLASS_I' : 'CLASS_II',
            purpose: 'SHORTLIST_OPTIMIZATION',
            candidateIdsJson: json(selectedCandidateIds),
            projectedCoverage,
            averageHits: selectedCandidateIds.length,
            provenanceJson: json({
              ...optimization.provenance,
              sourceStatus: optimization.provenance.status,
              method: optimization.provenance.method,
              selectedCandidateCount: selectedCandidateIds.length,
            }),
            snapshotHash: result.snapshotHash,
          });
        }
        const optimizationEntity = await repositories.shortlistOptimizationResults.create({
          runId: command.runId,
          track: optimization.track,
          eligibleCandidateIdsJson: json(eligibleCandidateIds),
          finalCoverageResultId: finalCoverageResult.id,
          algorithmId: optimization.algorithmId,
          algorithmVersion: optimization.algorithmVersion,
          snapshotHash: result.snapshotHash,
        });
        for (const step of optimization.steps) {
          const selectedEntity = candidateEntityByRef.get(step.candidateId);
          if (selectedEntity === undefined) continue;
          await repositories.shortlistSelectionSteps.create({
            shortlistOptimizationResultId: optimizationEntity.id,
            step: step.step,
            selectedCandidateId: selectedEntity.id,
            marginalCoverageGain: step.marginalCoverageGain,
            cumulativeCoverage: step.cumulativeCoverage,
            reasonCode: step.reasonCode,
          });
        }
      }

      await persistGraph({
        repositories,
        runId: command.runId,
        proteinHash,
        result,
        candidateEntityByRef,
        observationEntityByRef,
        rankingEntityByRef,
      });
      await repositories.events.appendNext({
        runId: command.runId,
        stageId: stageByKey.get('final_ranking')!.id,
        eventType: 'candidate.summary_ready',
        level: result.executionMode === 'LIVE' ? 'INFO' : 'WARN',
        message:
          result.executionMode === 'SYNTHETIC' || result.executionMode === 'HYBRID'
            ? 'Candidates are ready with offline demonstration provenance.'
            : 'Candidates and rankings are ready.',
        payloadJson: json({
          runId: command.runId,
          requestId: command.requestId,
          executionMode: result.executionMode,
          sourceStatuses: result.sourceStatuses,
          scientificUse: result.executionMode === 'LIVE',
          disclosure:
            result.executionMode === 'SYNTHETIC' || result.executionMode === 'HYBRID'
              ? SYNTHETIC_DISCLOSURE
              : undefined,
        }),
      });
      await repositories.runs.transitionControl(command.runId, ['RUNNING'], {
        status: 'AWAITING_SHORTLIST_APPROVAL',
        quality:
          result.executionMode === 'FIXTURE'
            ? 'FIXTURE_ONLY'
            : result.executionMode === 'LIVE'
              ? 'COMPLETE'
              : 'PARTIAL',
        executionMode: result.executionMode,
        replayHash: result.snapshotHash,
      });
    });
  }
}

function createWorkingCandidate(
  input: {
    candidateRef: string;
    candidateType: 'MHCI' | 'MHCII' | 'BCELL';
    peptide: string;
    start: number;
    end: number;
    length: number;
    allele?: string;
  },
  observation: WorkingObservation,
  proteinHash: string,
): WorkingCandidate {
  const key = hashJson({
    proteinHash,
    candidateType: input.candidateType,
    start: input.start,
    end: input.end,
    peptide: input.peptide,
    allele: input.allele ?? null,
  });
  return {
    ref: input.candidateRef,
    key,
    candidateType: input.candidateType,
    peptide: input.peptide,
    start: input.start,
    end: input.end,
    length: input.length,
    ...(input.allele === undefined ? {} : { allele: input.allele }),
    observations: [observation],
    bindingQuality: 0,
    weightedMean: 0,
    variance: 0,
    agreement: 0,
    completeness: 0,
    consensus: 0,
    coverage: [],
    candidateCoverage: 0,
    ruleOutcomes: [],
    passesHardConstraints: false,
    preliminaryScore: 0,
  };
}

function rankingInput(candidate: WorkingCandidate, profile: ConstraintProfile) {
  const common = {
    candidateId: candidate.ref,
    candidateKey: candidate.key,
    candidateType: candidate.candidateType,
    agreement: candidate.agreement,
    completeness: candidate.completeness,
    missingOptionalWeightFraction: 0,
    softWarningCount: candidate.ruleOutcomes.filter(({ outcome }) => outcome === 'WARN').length,
    start: candidate.start,
    blockingReviewCondition:
      candidate.agreement < profile.agreement.reviewBelow ||
      candidate.ruleOutcomes.some(({ outcome }) => outcome === 'NOT_EVALUATED'),
    ruleOutcomes: candidate.ruleOutcomes,
  };
  return candidate.candidateType === 'BCELL'
    ? { ...common, candidateType: 'BCELL' as const, predictorMean: candidate.bindingQuality }
    : {
        ...common,
        candidateType: candidate.candidateType,
        bindingQuality: candidate.bindingQuality,
        consensusQuality: candidate.consensus,
        candidateCoverage: candidate.candidateCoverage,
      };
}

function candidateSnapshot(candidate: WorkingCandidate) {
  return {
    ref: candidate.ref,
    key: candidate.key,
    candidateType: candidate.candidateType,
    peptide: candidate.peptide,
    start: candidate.start,
    end: candidate.end,
    allele: candidate.allele ?? null,
    observations: candidate.observations,
    coverage: candidate.coverage,
    bindingQuality: candidate.bindingQuality,
    consensus: candidate.consensus,
    completeness: candidate.completeness,
  };
}

function withDefinedOptimizationMetadata(
  provenance: ConnectorProvenance,
  metadata: {
    constructSequence?: string;
    averageCandidateScore?: number;
    redundancyPenalty?: number;
    objectiveScore?: number;
    confidence?: unknown;
    manufacturability?: unknown;
  },
): WorkingShortlistOptimization['provenance'] {
  const enriched: WorkingShortlistOptimization['provenance'] = { ...provenance };
  if (metadata.constructSequence !== undefined)
    enriched.constructSequence = metadata.constructSequence;
  if (metadata.averageCandidateScore !== undefined)
    enriched.averageCandidateScore = metadata.averageCandidateScore;
  if (metadata.redundancyPenalty !== undefined)
    enriched.redundancyPenalty = metadata.redundancyPenalty;
  if (metadata.objectiveScore !== undefined) enriched.objectiveScore = metadata.objectiveScore;
  if (metadata.confidence !== undefined) enriched.confidence = metadata.confidence;
  if (metadata.manufacturability !== undefined)
    enriched.manufacturability = metadata.manufacturability;
  return enriched;
}

function optimizationMetadata(data: z.infer<typeof shortlistOptimizationDataSchema>): {
  constructSequence?: string;
  averageCandidateScore?: number;
  redundancyPenalty?: number;
  objectiveScore?: number;
  confidence?: unknown;
  manufacturability?: unknown;
} {
  const metadata: ReturnType<typeof optimizationMetadata> = {};
  if (data.constructSequence !== undefined) metadata.constructSequence = data.constructSequence;
  if (data.averageCandidateScore !== undefined)
    metadata.averageCandidateScore = data.averageCandidateScore;
  if (data.redundancyPenalty !== undefined) metadata.redundancyPenalty = data.redundancyPenalty;
  if (data.objectiveScore !== undefined) metadata.objectiveScore = data.objectiveScore;
  if (data.confidence !== undefined) metadata.confidence = data.confidence;
  if (data.manufacturability !== undefined) metadata.manufacturability = data.manufacturability;
  return metadata;
}

function trackEnabled(configuration: StoredConfiguration, track: 'MHCI' | 'MHCII' | 'BCELL') {
  return configuration.analysis[track.toLowerCase() as 'mhci' | 'mhcii' | 'bcell'].enabled;
}

function numericMetric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function json(value: unknown): string {
  return canonicalJson(value);
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite JSON number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  throw new Error('Unsupported JSON value.');
}

async function persistGraph(input: {
  repositories: Pick<Repositories, 'graphNodes' | 'graphEdges'>;
  runId: string;
  proteinHash: string;
  result: PipelineResult;
  candidateEntityByRef: ReadonlyMap<string, { id: string }>;
  observationEntityByRef: ReadonlyMap<string, { id: string }>;
  rankingEntityByRef: ReadonlyMap<string, { id: string }>;
}) {
  const protein = await input.repositories.graphNodes.create({
    runId: input.runId,
    nodeType: 'PROTEIN',
    entityId: input.proteinHash,
    label: 'Input protein',
    propertiesJson: json({
      position: { x: 0, y: Math.max(120, input.result.candidates.length * 90) },
      subtitle: input.proteinHash.slice(0, 12),
      status: 'VALIDATED',
      sourceStatus: null,
      warningCode: null,
      detailLines: ['Validated through MCP'],
    }),
  });
  for (const [lane, candidate] of input.result.candidates.entries()) {
    const candidateEntity = input.candidateEntityByRef.get(candidate.ref)!;
    const observationEntity = input.observationEntityByRef.get(candidate.ref)!;
    const rankingEntity = input.rankingEntityByRef.get(candidate.ref)!;
    const ranking = input.result.rankings.find(({ candidateId }) => candidateId === candidate.ref)!;
    const sourceStatus = candidate.observations[0]!.provenance.status;
    const candidateNode = await input.repositories.graphNodes.create({
      runId: input.runId,
      nodeType: 'CANDIDATE',
      entityId: candidateEntity.id,
      label: candidate.peptide,
      propertiesJson: json({
        position: { x: 300, y: lane * 180 },
        subtitle: `${candidate.candidateType} ${candidate.start}-${candidate.end}`,
        status: ranking.category,
        sourceStatus,
        warningCode: sourceStatus === 'SYNTHETIC' ? 'DEMONSTRATION_ONLY' : null,
        detailLines: [
          candidate.allele ?? 'Allele-independent',
          `Score ${ranking.finalScore.toFixed(3)}`,
        ],
      }),
    });
    const observationNode = await input.repositories.graphNodes.create({
      runId: input.runId,
      nodeType: 'PREDICTION_OBSERVATION',
      entityId: observationEntity.id,
      label: candidate.observations[0]!.method,
      propertiesJson: json({
        position: { x: 620, y: lane * 180 },
        subtitle: candidate.observations[0]!.methodVersion,
        status: 'RECORDED',
        sourceStatus,
        warningCode: sourceStatus === 'SYNTHETIC' ? 'DEMONSTRATION_ONLY' : null,
        detailLines: [`Normalized ${candidate.observations[0]!.normalizedScore.toFixed(3)}`],
      }),
    });
    const rankingNode = await input.repositories.graphNodes.create({
      runId: input.runId,
      nodeType: 'RANKING_RESULT',
      entityId: rankingEntity.id,
      label: `${ranking.category} · rank ${ranking.trackRank}`,
      propertiesJson: json({
        position: { x: 940, y: lane * 180 },
        subtitle: `Final score ${ranking.finalScore.toFixed(3)}`,
        status: ranking.category,
        sourceStatus,
        warningCode: sourceStatus === 'SYNTHETIC' ? 'DEMONSTRATION_ONLY' : null,
        detailLines: [`Confidence ${ranking.confidence}`],
      }),
    });
    await input.repositories.graphEdges.create({
      runId: input.runId,
      edgeType: 'HAS_CANDIDATE',
      sourceNodeId: protein.id,
      targetNodeId: candidateNode.id,
      propertiesJson: json({ label: 'has candidate', provenance: sourceStatus }),
    });
    await input.repositories.graphEdges.create({
      runId: input.runId,
      edgeType: 'OBSERVED_AS',
      sourceNodeId: candidateNode.id,
      targetNodeId: observationNode.id,
      propertiesJson: json({ label: 'observed as', provenance: sourceStatus }),
    });
    await input.repositories.graphEdges.create({
      runId: input.runId,
      edgeType: 'RANKED_AS',
      sourceNodeId: candidateNode.id,
      targetNodeId: rankingNode.id,
      propertiesJson: json({ label: 'ranked as', provenance: sourceStatus }),
    });
  }
}

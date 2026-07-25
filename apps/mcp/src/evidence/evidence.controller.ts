import {
  calculateSyntheticCoverage,
  calculateConsensus,
  calculatePreliminaryScore,
  normalizeScore,
  rankCandidates,
  SYNTHETIC_COVERAGE_ALGORITHM,
  SYNTHETIC_COVERAGE_ALGORITHM_VERSION,
} from '@immunograph/algorithms';
import {
  computeCanonicalJsonHash,
  loadProfileVersion,
  loadReferenceBundle,
  rankingProfileSchema,
} from '@immunograph/database';
import { ControllerDecorator, ToolDecorator } from '@nitrostack/core';
import type { ExecutionContext } from '@nitrostack/core';
import type { z } from 'zod';

import type { CapabilityPort } from '../common/capability-port.js';
import { executeTool, ToolExecutionError } from '../common/executor.js';
import { localFixtureCapabilityPort } from '../common/local-fixture-capability-port.js';
import {
  consensusContract,
  consensusBatchContract,
  normalizeScoresContract,
  optimizeCoverageContract,
  populationCoverageContract,
  syntheticPopulationCoverageContract,
  rankCandidatesContract,
  toolOptions,
} from '../tool-contracts.js';

const CATEGORY = 'Evidence Tools';
const referenceBundle = loadReferenceBundle();

@ControllerDecorator()
export class EvidenceController {
  private capabilities: CapabilityPort = localFixtureCapabilityPort;

  useCapabilityPort(capabilities: CapabilityPort): this {
    this.capabilities = capabilities;
    return this;
  }

  @ToolDecorator(toolOptions(normalizeScoresContract, CATEGORY))
  normalizeScores(input: unknown, context: ExecutionContext) {
    return executeTool({
      toolName: normalizeScoresContract.name,
      input,
      inputSchema: normalizeScoresContract.inputSchema,
      dataSchema: normalizeScoresContract.dataSchema,
      context,
      operation: (validated) => ({
        values: validated.observations
          .map((observation) => {
            if (observation.profile === undefined) {
              throw new ToolExecutionError(
                'NORMALIZATION_PROFILE_MISSING',
                'SCIENTIFIC',
                `No normalization profile is registered for ${observation.observationId}.`,
              );
            }
            return {
              observationId: observation.observationId,
              normalizedScore: normalizeScore(observation.rawScore, observation.profile),
              transformation: observation.profile,
            };
          })
          .sort((left, right) => left.observationId.localeCompare(right.observationId)),
      }),
    });
  }

  @ToolDecorator(toolOptions(consensusContract, CATEGORY))
  computeConsensus(input: unknown, context: ExecutionContext) {
    return executeTool({
      toolName: consensusContract.name,
      input,
      inputSchema: consensusContract.inputSchema,
      dataSchema: consensusContract.dataSchema,
      context,
      operation: (validated) => ({
        groupKey: validated.groupKey,
        ...calculateConsensus(validated.observations, validated.configuredRequiredWeight),
      }),
    });
  }

  @ToolDecorator(toolOptions(consensusBatchContract, CATEGORY))
  computeConsensusBatch(input: unknown, context: ExecutionContext) {
    return executeTool({
      toolName: consensusBatchContract.name,
      input,
      inputSchema: consensusBatchContract.inputSchema,
      dataSchema: consensusBatchContract.dataSchema,
      context,
      operation: (validated) => ({
        groups: validated.groups.map((group) => ({
          groupKey: group.groupKey,
          ...calculateConsensus(group.observations, group.configuredRequiredWeight),
        })),
      }),
    });
  }

  @ToolDecorator(toolOptions(populationCoverageContract, CATEGORY))
  calculatePopulationCoverage(input: unknown, context: ExecutionContext) {
    return this.invokeCapability(populationCoverageContract, input, context);
  }

  @ToolDecorator(toolOptions(syntheticPopulationCoverageContract, CATEGORY))
  async calculateSyntheticPopulationCoverage(input: unknown, context: ExecutionContext) {
    return executeTool({
      toolName: syntheticPopulationCoverageContract.name,
      input,
      inputSchema: syntheticPopulationCoverageContract.inputSchema,
      dataSchema: syntheticPopulationCoverageContract.dataSchema,
      context,
      operation: async (validated) => {
        const bundle = await referenceBundle;
        const frequencies = bundle.hlaRegistry.alleles.flatMap((allele) =>
          (allele.populationFrequencies ?? []).map((frequency) => ({
            allele: allele.allele,
            populationId: frequency.populationId,
            value: frequency.value,
            sourceKind: frequency.sourceKind,
            scientificUse: frequency.scientificUse,
          })),
        );
        const alleles = validated.associations.map(({ allele }) => allele);
        const populations = validated.populationIds.flatMap((populationId) => {
          const result = calculateSyntheticCoverage({
            populationId,
            alleles,
            frequencies: frequencies.filter(
              (
                frequency,
              ): frequency is typeof frequency & {
                sourceKind: 'SYNTHETIC';
                scientificUse: false;
              } => frequency.sourceKind === 'SYNTHETIC' && frequency.scientificUse === false,
            ),
          });
          return result === null ? [] : [{ populationId, ...result }];
        });
        const available = new Set(populations.map(({ populationId }) => populationId));
        return {
          populations,
          unavailablePopulationIds: validated.populationIds.filter((id) => !available.has(id)),
          provenance: {
            connectorId: 'immunograph-synthetic-coverage',
            connectorVersion: '1.0.0',
            method: 'synthetic-diploid-independence-demonstration',
            methodVersion: SYNTHETIC_COVERAGE_ALGORITHM_VERSION,
            status: 'SYNTHETIC' as const,
            sourceUri: 'https://immunograph.local/reference/hla-alleles',
            parameters: { classMode: validated.classMode },
            predictionSource: 'SYNTHETIC' as const,
            scientificUse: false,
            validationStatus: 'DEMONSTRATION_ONLY' as const,
            algorithm: SYNTHETIC_COVERAGE_ALGORITHM,
            algorithmVersion: SYNTHETIC_COVERAGE_ALGORITHM_VERSION,
            datasetVersion: bundle.hlaRegistry.version,
            datasetHash: computeCanonicalJsonHash(bundle.hlaRegistry),
          },
        };
      },
    });
  }

  @ToolDecorator(toolOptions(rankCandidatesContract, CATEGORY))
  rankCandidatesTool(input: unknown, context: ExecutionContext) {
    return executeTool({
      toolName: rankCandidatesContract.name,
      input,
      inputSchema: rankCandidatesContract.inputSchema,
      dataSchema: rankCandidatesContract.dataSchema,
      context,
      operation: async (validated) => {
        if (!validated.baseConstraintsComplete) {
          throw new ToolExecutionError(
            'BASE_CONSTRAINTS_INCOMPLETE',
            'SCIENTIFIC',
            'Base constraints must be complete before ranking.',
          );
        }
        if (validated.phase === 'FINAL' && !validated.finalConstraintsComplete) {
          throw new ToolExecutionError(
            'FINAL_CONSTRAINTS_INCOMPLETE',
            'SCIENTIFIC',
            'Duplicate and overlap outcomes must be complete before final ranking.',
          );
        }
        const loadedProfile = await loadProfileVersion('ranking', validated.rankingProfileVersion);
        const profile = rankingProfileSchema.parse(loadedProfile.definition);
        const scored = validated.candidates.map((candidate) => {
          const result =
            candidate.candidateType === 'BCELL'
              ? calculatePreliminaryScore({
                  track: 'BCELL',
                  predictorMean: candidate.predictorMean,
                  completeness: candidate.completeness,
                  missingOptionalWeightFraction: candidate.missingOptionalWeightFraction,
                  softWarningCount: candidate.softWarningCount,
                  weights: profile.bCell,
                })
              : calculatePreliminaryScore({
                  track: 'TCELL',
                  bindingQuality: candidate.bindingQuality,
                  consensusQuality: candidate.consensusQuality,
                  candidateCoverage: candidate.candidateCoverage,
                  completeness: candidate.completeness,
                  missingOptionalWeightFraction: candidate.missingOptionalWeightFraction,
                  softWarningCount: candidate.softWarningCount,
                  weights: profile.tCell,
                });
          const componentScores =
            candidate.candidateType === 'BCELL'
              ? { graphBepi: candidate.predictorMean, completeness: candidate.completeness }
              : {
                  binding: candidate.bindingQuality,
                  consensus: candidate.consensusQuality,
                  populationCoverage: candidate.candidateCoverage,
                  completeness: candidate.completeness,
                };
          return { candidate, result, componentScores };
        });
        if (validated.phase === 'PRELIMINARY') {
          return {
            phase: 'PRELIMINARY' as const,
            candidates: scored.map(({ candidate, result, componentScores }) => ({
              candidateId: candidate.candidateId,
              componentScores,
              scoreBeforePenalty: result.scoreBeforePenalty,
              missingEvidencePenalty: result.missingEvidencePenalty,
              softWarningPenalty: result.softWarningPenalty,
              fixturePenalty: result.fixturePenalty,
              finalScore: result.score,
            })),
          };
        }
        const tracks = [...new Set(scored.map(({ candidate }) => candidate.candidateType))].sort();
        const candidates = tracks.flatMap((track) => {
          const trackCandidates = scored.filter(
            ({ candidate }) => candidate.candidateType === track,
          );
          const scoreById = new Map(
            trackCandidates.map((item) => [item.candidate.candidateId, item]),
          );
          return rankCandidates(
            trackCandidates.map(({ candidate, result }) => ({
              candidateId: candidate.candidateId,
              candidateKey: candidate.candidateKey,
              candidateType: candidate.candidateType,
              finalScore: result.score,
              agreement: candidate.agreement,
              completeness: candidate.completeness,
              start: candidate.start,
              blockingReviewCondition: candidate.blockingReviewCondition,
              ruleOutcomes: candidate.ruleOutcomes,
            })),
            validated.thresholds,
          ).map((candidate) => {
            const score = scoreById.get(candidate.candidateId);
            if (score === undefined) throw new Error('Ranked candidate score was not found.');
            return {
              ...candidate,
              ruleOutcomes: candidate.ruleOutcomes.map((outcome) => ({
                ...outcome,
                evidenceRefs: [...outcome.evidenceRefs],
              })),
              componentScores: score.componentScores,
              scoreBeforePenalty: score.result.scoreBeforePenalty,
              missingEvidencePenalty: score.result.missingEvidencePenalty,
              softWarningPenalty: score.result.softWarningPenalty,
              fixturePenalty: score.result.fixturePenalty,
              confidenceScore:
                candidate.category === 'REJECTED'
                  ? 0
                  : Math.min(score.result.score, candidate.completeness, candidate.agreement),
            };
          });
        });
        return { phase: 'FINAL' as const, candidates };
      },
    });
  }

  @ToolDecorator(toolOptions(optimizeCoverageContract, CATEGORY))
  optimizeShortlistCoverage(input: unknown, context: ExecutionContext) {
    return this.invokeCapability(optimizeCoverageContract, input, context);
  }

  private invokeCapability<TInput extends z.ZodTypeAny, TData extends z.ZodTypeAny>(
    contract: { name: string; inputSchema: TInput; dataSchema: TData },
    input: unknown,
    context: ExecutionContext,
  ) {
    return executeTool({
      toolName: contract.name,
      input,
      inputSchema: contract.inputSchema,
      dataSchema: contract.dataSchema,
      context,
      operation: async (validated) =>
        this.capabilities.invoke(contract.name, validated) as Promise<z.infer<TData>>,
    });
  }
}

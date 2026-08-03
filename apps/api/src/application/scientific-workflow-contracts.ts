import { z } from 'zod';

const identifier = z.string().min(1);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const unit = z.number().finite().min(0).max(1);
const positiveInteger = z.number().int().positive();
const candidateType = z.enum(['MHCI', 'MHCII', 'BCELL']);

export const connectorProvenanceSchema = z
  .object({
    connectorId: identifier,
    connectorVersion: identifier,
    method: identifier,
    methodVersion: identifier,
    status: z.enum(['LIVE', 'CACHED', 'SYNTHETIC', 'FIXTURE', 'FAILED']),
    sourceUri: z.string().url().optional(),
    cacheKey: sha256.optional(),
    fixtureId: identifier.optional(),
    parameters: z.record(z.unknown()),
    predictionSource: z.enum(['LIVE', 'CACHED', 'SYNTHETIC', 'FIXTURE']).optional(),
    scientificUse: z.boolean().optional(),
    validationStatus: z.enum(['SCIENTIFIC', 'DEMONSTRATION_ONLY', 'VERIFIED_FIXTURE']).optional(),
    algorithm: identifier.optional(),
    algorithmVersion: identifier.optional(),
    datasetVersion: identifier.optional(),
    datasetHash: sha256.optional(),
  })
  .passthrough();

export const validateSequenceDataSchema = z.object({
  normalizedSequence: identifier,
  header: z.string(),
  sequenceLength: positiveInteger,
  sha256,
  warnings: z.array(z.string()),
});

export const generatedCandidateSchema = z.object({
  candidateType: z.enum(['MHCI', 'MHCII']),
  start: positiveInteger,
  end: positiveInteger,
  length: positiveInteger,
  peptide: identifier,
});

export const generatedCandidatesDataSchema = z.object({
  candidates: z.array(generatedCandidateSchema),
});

export const syntheticBindingDataSchema = z.object({
  observations: z.array(
    z.object({
      observationId: identifier,
      candidateRef: identifier,
      candidateType: z.enum(['MHCI', 'MHCII']),
      peptide: identifier,
      start: positiveInteger,
      end: positiveInteger,
      length: positiveInteger,
      allele: identifier,
      method: identifier,
      methodVersion: identifier,
      rawScore: unit,
      percentileRank: z.number().finite().min(0).max(100),
      normalizedScore: unit,
      modelScores: z
        .object({
          mlScore: unit,
          dlScore: unit,
          ensembleScore: unit,
          uncertainty: unit,
        })
        .optional(),
      rawFields: z.record(z.unknown()),
    }),
  ),
  provenance: connectorProvenanceSchema,
});

export const scientificBindingDataSchema = z.object({
  observations: z.array(
    z.object({
      observationId: identifier,
      candidateRef: identifier,
      candidateType: z.enum(['MHCI', 'MHCII']),
      peptide: identifier,
      start: positiveInteger,
      end: positiveInteger,
      length: positiveInteger,
      allele: identifier.optional(),
      method: identifier,
      methodVersion: identifier,
      rawScore: z.number().finite(),
      percentileRank: z.number().finite().nonnegative().optional(),
      rawFields: z.record(z.unknown()),
    }),
  ),
  provenance: z.array(connectorProvenanceSchema),
});

export const bcellPredictionDataSchema = z.object({
  residueScores: z.array(z.object({ position: positiveInteger, score: unit })),
  regions: z.array(z.object({ start: positiveInteger, end: positiveInteger, score: unit })),
  rawMethodFields: z.record(z.unknown()),
  provenance: z.array(connectorProvenanceSchema),
});

export const normalizedScoresDataSchema = z.object({
  values: z.array(
    z.object({
      observationId: identifier,
      normalizedScore: unit,
      transformation: z.record(z.unknown()),
    }),
  ),
});

export const consensusDataSchema = z.object({
  groupKey: identifier,
  weightedMean: unit,
  weightedVariance: z.number().finite().nonnegative(),
  agreement: unit,
  agreementStatus: z.enum(['SUFFICIENT_OBSERVATIONS', 'INSUFFICIENT_OBSERVATIONS']),
  completeness: unit,
  consensus: unit,
});

export const consensusBatchDataSchema = z.object({ groups: z.array(consensusDataSchema) });

export const syntheticCoverageDataSchema = z.object({
  populations: z.array(
    z.object({
      populationId: identifier,
      projectedCoverage: unit,
      averageHits: z.number().finite().nonnegative(),
      alleleCarrierProbabilities: z.array(
        z.object({ allele: identifier, carrierProbability: unit }),
      ),
    }),
  ),
  unavailablePopulationIds: z.array(identifier),
  provenance: connectorProvenanceSchema,
});

export const scientificCoverageDataSchema = z.object({
  projectedCoverage: unit,
  metrics: z.record(z.unknown()),
  provenance: connectorProvenanceSchema,
});

export const shortlistOptimizationDataSchema = z.object({
  steps: z.array(
    z.object({
      candidateId: identifier,
      marginalGain: unit,
      cumulativeCoverage: unit,
    }),
  ),
  selectedCandidateIds: z.array(identifier),
  finalCoverage: unit,
  coverageByPopulation: z.record(unit).optional(),
  constructSequence: z.string().optional(),
  averageCandidateScore: unit.optional(),
  redundancyPenalty: unit.optional(),
  objectiveScore: unit.optional(),
  confidence: z
    .object({
      label: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      score: unit,
      uncertainty: unit,
      calibrationMethod: identifier,
      scientificUse: z.literal(false),
      reasons: z.array(z.string()),
    })
    .strict()
    .optional(),
  manufacturability: z
    .object({
      status: z.enum(['PASS', 'WARN', 'FAIL']),
      checks: z.array(
        z
          .object({
            ruleId: identifier,
            status: z.enum(['PASS', 'WARN', 'FAIL']),
            message: z.string(),
          })
          .strict(),
      ),
    })
    .strict()
    .optional(),
  provenance: connectorProvenanceSchema,
});

export const ruleOutcomeSchema = z.object({
  ruleId: identifier,
  ruleVersion: identifier,
  severity: z.enum(['HARD', 'SOFT']),
  outcome: z.enum(['PASS', 'WARN', 'FAIL', 'NOT_EVALUATED']),
  evidenceRefs: z.array(identifier),
  message: z.string().min(1),
});

export const thresholdValidationDataSchema = z.object({
  ruleProfileVersion: identifier,
  results: z.array(
    z.object({
      candidateId: identifier,
      passesAllHardConstraints: z.boolean(),
      outcomes: z.array(ruleOutcomeSchema),
    }),
  ),
});

export const preliminaryRankingDataSchema = z.object({
  phase: z.literal('PRELIMINARY'),
  candidates: z.array(
    z.object({
      candidateId: identifier,
      componentScores: z.record(unit),
      scoreBeforePenalty: unit,
      missingEvidencePenalty: z.number().nonnegative(),
      softWarningPenalty: z.number().nonnegative(),
      fixturePenalty: z.literal(0),
      finalScore: unit,
    }),
  ),
});

export const appliedConstraintsDataSchema = z.object({
  snapshotHash: sha256,
  ruleProfileVersion: identifier,
  constraintResults: z.array(
    z.object({
      candidateId: identifier,
      passesAllHardConstraints: z.boolean(),
      outcomes: z.array(ruleOutcomeSchema),
    }),
  ),
  duplicateLinks: z.array(
    z.object({
      duplicateId: identifier,
      canonicalId: identifier,
      edgeType: z.literal('DUPLICATE_OF'),
      ruleId: z.literal('DUPLICATE-001'),
    }),
  ),
  retainedCandidateIds: z.array(identifier),
  overlapRejections: z.array(
    z.object({
      candidateId: identifier,
      retainedCandidateId: identifier,
      ruleId: z.literal('BIO-OVERLAP-001'),
    }),
  ),
  eligibleCandidateIds: z.array(identifier),
});

export const finalRankingDataSchema = z.object({
  phase: z.literal('FINAL'),
  candidates: z.array(
    z.object({
      candidateId: identifier,
      candidateKey: identifier,
      candidateType,
      finalScore: unit,
      agreement: unit,
      completeness: unit,
      start: positiveInteger,
      blockingReviewCondition: z.boolean(),
      ruleOutcomes: z.array(ruleOutcomeSchema),
      componentScores: z.record(unit),
      scoreBeforePenalty: unit,
      missingEvidencePenalty: z.number().nonnegative(),
      softWarningPenalty: z.number().nonnegative(),
      fixturePenalty: z.literal(0),
      category: z.enum(['RECOMMENDED', 'REVIEW', 'REJECTED']),
      confidence: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NOT_APPLICABLE']),
      confidenceScore: unit,
      trackRank: positiveInteger,
      categoryRank: positiveInteger,
    }),
  ),
});

export type ConnectorProvenance = z.infer<typeof connectorProvenanceSchema>;
export type RuleOutcome = z.infer<typeof ruleOutcomeSchema>;

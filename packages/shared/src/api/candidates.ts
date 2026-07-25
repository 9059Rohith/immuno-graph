import { z } from 'zod';

import {
  categorySchema,
  isoInstantSchema,
  sha256Schema,
  sourceStatusSchema,
  trackSchema,
  uuidSchema,
} from './common.js';

export const measuredValueSchema = z
  .object({
    value: z.number().finite().nullable(),
    unavailableReason: z.string().nullable(),
    sourceStatus: sourceStatusSchema.nullable(),
  })
  .strict();

export const candidateCardSchema = z
  .object({
    id: uuidSchema,
    track: trackSchema,
    rank: z.number().int().positive(),
    peptide: z.string(),
    start: z.number().int().positive(),
    end: z.number().int().positive(),
    allele: z.string().nullable(),
    predictorScore: measuredValueSchema,
    agreement: measuredValueSchema,
    completeness: measuredValueSchema,
    singletonCoverage: measuredValueSchema,
    finalScore: z.number().finite(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    category: categorySchema,
    topReasons: z.array(z.string()),
    warnings: z.array(z.string()),
    sourceMix: z.array(sourceStatusSchema),
    selectable: z.boolean(),
  })
  .strict();

export const candidateListSchema = z
  .object({
    items: z.array(candidateCardSchema),
    nextCursor: z.string().nullable(),
    rankingSnapshotHash: sha256Schema,
  })
  .strict();

export const candidateDetailSchema = z
  .object({
    candidate: candidateCardSchema,
    observations: z.array(
      z
        .object({
          method: z.string(),
          version: z.string(),
          sourceStatus: sourceStatusSchema,
          rawValue: z.number(),
          normalizedValue: z.number().nullable(),
          transformation: z.string().nullable(),
        })
        .strict(),
    ),
    consensus: measuredValueSchema,
    completeness: measuredValueSchema,
    singletonCoverage: measuredValueSchema,
    shortlistCoverage: measuredValueSchema,
    constraints: z.array(
      z
        .object({
          ruleId: z.string(),
          label: z.string(),
          outcome: z.enum(['PASS', 'REVIEW', 'FAIL']),
          reason: z.string(),
        })
        .strict(),
    ),
    ranking: z
      .object({
        components: z.array(
          z.object({ name: z.string(), value: z.number(), effectiveWeight: z.number() }).strict(),
        ),
        penalties: z.array(z.object({ name: z.string(), value: z.number() }).strict()),
        finalScore: z.number(),
      })
      .strict(),
    graphNeighborIds: z.array(z.string()),
    deterministicExplanation: z.string(),
    llmExplanation: z
      .object({ text: z.string(), generationModeUsed: z.enum(['DETERMINISTIC', 'LLM']) })
      .strict()
      .nullable(),
  })
  .strict();

export const coverageSchema = z
  .object({
    populationId: z.string(),
    purpose: z.enum(['CANDIDATE_RANKING', 'SHORTLIST_OPTIMIZATION', 'FINAL_SHORTLIST']),
    candidateId: uuidSchema.nullable(),
    coverage: measuredValueSchema,
    method: z.string().nullable(),
    observedAt: isoInstantSchema.nullable(),
  })
  .strict();

export const candidateComparisonSchema = z
  .object({
    track: trackSchema,
    candidates: z.array(
      z
        .object({
          id: uuidSchema,
          peptide: z.string(),
          rank: z.number().int().positive(),
          finalScore: z.number().finite(),
          confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
          category: categorySchema,
        })
        .strict(),
    ),
    components: z.array(
      z
        .object({
          name: z.string(),
          values: z.record(uuidSchema, z.number().finite().nullable()),
        })
        .strict(),
    ),
    constraints: z.array(
      z
        .object({
          ruleId: z.string(),
          label: z.string(),
          outcomes: z.record(uuidSchema, z.enum(['PASS', 'REVIEW', 'FAIL'])),
        })
        .strict(),
    ),
  })
  .strict();

export type CandidateCard = z.infer<typeof candidateCardSchema>;
export type CandidateList = z.infer<typeof candidateListSchema>;
export type CandidateDetail = z.infer<typeof candidateDetailSchema>;
export type CandidateComparison = z.infer<typeof candidateComparisonSchema>;

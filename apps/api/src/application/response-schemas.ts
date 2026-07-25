import {
  isoInstantSchema,
  sha256Schema,
  sourceStatusSchema,
  uuidSchema,
} from '@immunograph/shared';
import { z } from 'zod';

const eventTypeSchema = z.enum([
  'run.status_changed',
  'stage.status_changed',
  'stage.progress',
  'connector.status_changed',
  'approval.required',
  'candidate.summary_ready',
  'artifact.created',
  'run.warning',
]);

export const eventHistorySchema = z
  .object({
    items: z.array(
      z
        .object({
          id: z.string().regex(/^\d+$/),
          event: eventTypeSchema,
          data: z.record(z.unknown()),
        })
        .strict(),
    ),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const projectDeleteResponseSchema = z
  .object({ projectId: uuidSchema, deleted: z.literal(true) })
  .strict();

export const explanationResponseSchema = z
  .object({
    text: z.string().min(1),
    generationModeUsed: z.enum(['DETERMINISTIC', 'LLM']),
  })
  .strict();

export const shortlistOptimizationResponseSchema = z
  .object({
    rankingSnapshotHash: sha256Schema,
    track: z.enum(['MHCI', 'MHCII']),
    algorithmId: z.string().min(1),
    algorithmVersion: z.string().min(1),
    steps: z.array(
      z
        .object({
          step: z.number().int().positive(),
          candidateId: uuidSchema,
          marginalCoverageGain: z.number().min(0).max(1),
          cumulativeCoverage: z.number().min(0).max(1),
          reasonCode: z.string().min(1),
        })
        .strict(),
    ),
    finalCoverage: z.number().min(0).max(1),
  })
  .strict();

export const constraintSummaryResponseSchema = z
  .object({
    version: z.literal('1'),
    outcomes: z.array(
      z
        .object({
          outcome: z.enum(['PASS', 'REVIEW', 'FAIL']),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    generatedAt: isoInstantSchema,
  })
  .strict();

export const scoreDistributionResponseSchema = z
  .object({
    version: z.literal('1'),
    bins: z.array(
      z
        .object({
          minimum: z.number().min(0).max(1),
          maximum: z.number().min(0).max(1),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    generatedAt: isoInstantSchema,
  })
  .strict();

export const connectorStatusResponseSchema = z
  .object({
    version: z.literal('1'),
    connectors: z.array(
      z
        .object({
          connectorId: z.string().min(1),
          method: z.string().min(1),
          sourceStatus: sourceStatusSchema,
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    generatedAt: isoInstantSchema,
  })
  .strict();

export type EventHistory = z.infer<typeof eventHistorySchema>;
export type ShortlistOptimizationResponse = z.infer<typeof shortlistOptimizationResponseSchema>;

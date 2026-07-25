import { z } from 'zod';

import {
  isoInstantSchema,
  executionModeSchema,
  requestedExecutionModeSchema,
  runQualitySchema,
  runStatusSchema,
  sha256Schema,
  sourceStatusSchema,
  trackSchema,
  uuidSchema,
} from './common.js';

export const outputPreferencesSchema = z
  .object({
    formats: z.array(z.enum(['JSON', 'CSV'])).min(1),
    templateVersion: z.string().min(1),
    includeWorkflowTrace: z.boolean(),
    includeEvidenceGraph: z.boolean(),
  })
  .strict();

const tCellSchema = z
  .object({
    enabled: z.boolean(),
    alleles: z.array(z.string()),
    peptideLengths: z.array(z.number().int().positive()),
    methods: z.array(z.string()),
  })
  .strict();

export const runConfigurationSchema = z
  .object({
    analysis: z
      .object({
        mhci: tCellSchema,
        mhcii: tCellSchema,
        bcell: z.object({ enabled: z.boolean(), methods: z.array(z.string()) }).strict(),
      })
      .strict(),
    populations: z.array(z.string()),
    fallbackPolicy: z.string(),
    requestedExecutionMode: requestedExecutionModeSchema.default('AUTO'),
    ruleProfileVersion: z.string(),
    rankingProfileVersion: z.string(),
    outputPreferences: outputPreferencesSchema,
  })
  .strict();

export const runDetailSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    revision: z.number().int().positive(),
    status: runStatusSchema,
    quality: runQualitySchema.nullable(),
    executionMode: executionModeSchema.nullable(),
    configurationHash: sha256Schema,
    configuration: runConfigurationSchema,
    candidateCounts: z.record(
      trackSchema,
      z.object({ recommended: z.number(), review: z.number(), rejected: z.number() }).strict(),
    ),
    stageProgress: z.array(
      z
        .object({
          stageKey: z.string(),
          label: z.string(),
          status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED']),
          attempt: z.number().int().positive(),
          progress: z.number().min(0).max(1),
          durationMs: z.number().nullable(),
          sourceStatus: sourceStatusSchema.nullable(),
          warningCode: z.string().nullable(),
          errorCode: z.string().nullable(),
          retryable: z.boolean(),
        })
        .strict(),
    ),
    connectors: z.array(
      z
        .object({
          connectorId: z.string(),
          method: z.string(),
          sourceStatus: sourceStatusSchema,
          version: z.string(),
          durationMs: z.number().nonnegative(),
          note: z.string().nullable(),
        })
        .strict(),
    ),
    approvalRequirements: z.array(z.enum(['CONFIGURATION', 'SHORTLIST'])),
    createdAt: isoInstantSchema,
    startedAt: isoInstantSchema.nullable(),
    completedAt: isoInstantSchema.nullable(),
    updatedAt: isoInstantSchema,
  })
  .strict();

export type RunDetail = z.infer<typeof runDetailSchema>;
export type RunConfiguration = z.input<typeof runConfigurationSchema>;
export type NormalizedRunConfiguration = z.output<typeof runConfigurationSchema>;

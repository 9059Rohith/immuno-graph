import { z } from 'zod';

import {
  executionModeSchema,
  isoInstantSchema,
  requestedExecutionModeSchema,
  runQualitySchema,
  runStatusSchema,
  sha256Schema,
  sourceStatusSchema,
  uuidSchema,
} from './common.js';

export const trustCheckSchema = z
  .object({
    id: z.enum([
      'fixture_manifest_valid',
      'provenance_complete',
      'constraints_enforced',
      'approval_gate',
      'artifact_hashes',
      'abstention_visible',
    ]),
    label: z.string().min(1),
    status: z.enum(['PASS', 'FAIL', 'UNAVAILABLE']),
    detail: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const trustSummarySchema = z
  .object({
    run: z
      .object({
        id: uuidSchema,
        revision: z.number().int().positive(),
        status: runStatusSchema,
        quality: runQualitySchema.nullable(),
        requestedExecutionMode: requestedExecutionModeSchema.nullable(),
        executionMode: executionModeSchema.nullable(),
        configurationHash: sha256Schema,
      })
      .strict(),
    fixtureManifest: z
      .object({
        version: z.string().min(1),
        sha256: sha256Schema,
        fixtureId: z.string().min(1),
        entrySha256: sha256Schema,
        reviewStatus: z.literal('APPROVED'),
        sourceKind: z.literal('SYNTHETIC'),
        scientificUse: z.literal(false),
      })
      .strict()
      .nullable(),
    sourceCounts: z.array(
      z.object({ status: sourceStatusSchema, count: z.number().int().nonnegative() }).strict(),
    ),
    stages: z.array(
      z
        .object({
          stageKey: z.string().min(1),
          attempt: z.number().int().positive(),
          status: z.enum(['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED']),
          inputHash: sha256Schema,
          outputHash: sha256Schema.nullable(),
        })
        .strict(),
    ),
    approvals: z.array(
      z
        .object({
          id: uuidSchema,
          type: z.enum(['CONFIGURATION', 'SHORTLIST']),
          status: z.enum(['REQUIRED', 'APPROVED']),
          snapshotHash: sha256Schema,
          recordedAt: isoInstantSchema,
        })
        .strict(),
    ),
    artifacts: z.array(
      z
        .object({
          id: uuidSchema,
          type: z.string().min(1),
          format: z.string().min(1),
          byteSize: z.number().int().nonnegative(),
          sha256: sha256Schema,
          createdAt: isoInstantSchema,
        })
        .strict(),
    ),
    checks: z.array(trustCheckSchema),
    disclaimer: z.literal('Demonstration only — not scientific output.'),
    evaluatedAt: isoInstantSchema,
  })
  .strict();

export type TrustCheck = z.infer<typeof trustCheckSchema>;
export type TrustSummary = z.infer<typeof trustSummarySchema>;

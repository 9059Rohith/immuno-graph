import { z } from 'zod';

import {
  isoInstantSchema,
  runQualitySchema,
  runStatusSchema,
  sha256Schema,
  sourceStatusSchema,
  uuidSchema,
} from './common.js';

export const runSummarySchema = z
  .object({
    id: uuidSchema,
    revision: z.number().int().positive(),
    status: runStatusSchema,
    quality: runQualitySchema.nullable(),
    sourceMix: z.array(sourceStatusSchema),
    updatedAt: isoInstantSchema,
  })
  .strict();

export const projectSummarySchema = z
  .object({
    id: uuidSchema,
    name: z.string().min(1),
    organism: z.string().nullable(),
    proteinName: z.string().nullable(),
    latestRun: runSummarySchema.nullable(),
    sourceMix: z.array(sourceStatusSchema),
    updatedAt: isoInstantSchema,
  })
  .strict();

export const projectListSchema = z
  .object({
    items: z.array(projectSummarySchema),
    nextCursor: z.string().nullable(),
    portfolioSummary: z
      .object({
        projectCount: z.number().int().nonnegative(),
        runCounts: z
          .object({
            total: z.number().int().nonnegative(),
            running: z.number().int().nonnegative(),
            completed: z.number().int().nonnegative(),
            failed: z.number().int().nonnegative(),
          })
          .strict(),
        candidateCount: z.number().int().nonnegative(),
        reportCount: z.number().int().nonnegative(),
        recentSince: isoInstantSchema,
        recentRunCount: z.number().int().nonnegative(),
        asOf: isoInstantSchema,
      })
      .strict(),
  })
  .strict();

export const projectDetailSchema = z
  .object({
    project: z
      .object({
        id: uuidSchema,
        name: z.string(),
        organism: z.string().nullable(),
        proteinName: z.string().nullable(),
        description: z.string().nullable(),
        createdAt: isoInstantSchema,
        updatedAt: isoInstantSchema,
      })
      .strict(),
    protein: z
      .object({
        id: uuidSchema,
        header: z.string(),
        length: z.number().int().positive(),
        sha256: sha256Schema,
        validationProfile: z.string(),
        warnings: z.array(z.string()),
      })
      .strict(),
    runs: z.array(runSummarySchema),
    latestApproval: z
      .object({
        kind: z.enum(['CONFIGURATION', 'SHORTLIST']),
        status: z.enum(['REQUIRED', 'APPROVED']),
        approvedAt: isoInstantSchema.nullable(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export const createdProjectSchema = z
  .object({
    project: projectDetailSchema.shape.project,
    protein: projectDetailSchema.shape.protein,
  })
  .strict();

export type ProjectList = z.infer<typeof projectListSchema>;
export type ProjectSummary = z.infer<typeof projectSummarySchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
export type CreatedProject = z.infer<typeof createdProjectSchema>;

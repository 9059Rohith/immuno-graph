import { z } from 'zod';

import { healthSchema, isoInstantSchema, sha256Schema, sourceStatusSchema } from './common.js';

export const connectorSchema = z
  .object({
    connectorId: z.string(),
    displayName: z.string(),
    methods: z.array(z.string()),
    liveSupported: z.boolean(),
    fixtureOnly: z.boolean(),
    licenseStatus: z.enum(['APPROVED', 'RESTRICTED', 'UNKNOWN']),
  })
  .strict();
export const connectorListSchema = z.object({ items: z.array(connectorSchema) }).strict();
export const connectorHealthListSchema = z
  .object({
    items: z.array(
      z
        .object({
          connectorId: z.string(),
          health: healthSchema,
          sourceStatus: sourceStatusSchema.nullable(),
          checkedAt: isoInstantSchema,
          message: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();
export const profileListSchema = z
  .object({
    items: z.array(
      z
        .object({
          name: z.string(),
          version: z.string(),
          sha256: sha256Schema,
          approved: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict();
export const runtimeSettingsSchema = z
  .object({
    demoMode: z.boolean(),
    llmEnabled: z.boolean(),
    databaseStatus: healthSchema,
    artifactPathStatus: healthSchema,
    fixtureManifest: z
      .object({
        version: z.string(),
        sha256: sha256Schema,
        entries: z.array(
          z
            .object({
              fixtureId: z.string(),
              organism: z.string(),
              proteinName: z.string(),
              approved: z.boolean(),
              sha256: sha256Schema,
            })
            .strict(),
        ),
      })
      .strict(),
    build: z
      .object({
        applicationVersion: z.string(),
        specificationVersion: z.string(),
        commitSha: z.string().nullable(),
        builtAt: isoInstantSchema.nullable(),
      })
      .strict(),
  })
  .strict();

export type RuntimeSettings = z.infer<typeof runtimeSettingsSchema>;

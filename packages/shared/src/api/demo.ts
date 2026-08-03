import { z } from 'zod';

import { isoInstantSchema, uuidSchema } from './common.js';

export const demoWorkspaceSchema = z
  .object({
    projectId: uuidSchema,
    runId: uuidSchema,
    expiresAt: isoInstantSchema,
    fixtureId: z.literal('dengue'),
    mode: z.literal('PUBLIC_DEMO'),
  })
  .strict();

export type DemoWorkspace = z.infer<typeof demoWorkspaceSchema>;

import { z } from 'zod';

import { categorySchema, isoInstantSchema, sourceStatusSchema, uuidSchema } from './common.js';
import { measuredValueSchema } from './candidates.js';

const nodeSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }).strict(),
    data: z
      .object({
        label: z.string(),
        subtitle: z.string().nullable(),
        status: z.string().nullable(),
        sourceStatus: sourceStatusSchema.nullable(),
        warningCode: z.string().nullable(),
        detailLines: z.array(z.string()),
      })
      .strict(),
  })
  .strict();

const edgeSchema = z
  .object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().nullable(),
    relation: z.string(),
    provenance: z.string().nullable(),
  })
  .strict();

export const graphSchema = z
  .object({
    version: z.string(),
    nodes: z.array(nodeSchema),
    edges: z.array(edgeSchema),
    generatedAt: isoInstantSchema,
  })
  .strict();

export const sequenceMapSchema = z
  .object({
    version: z.string(),
    proteinLength: z.number().int().positive(),
    tracks: z.array(z.object({ id: z.string(), label: z.string() }).strict()),
    segments: z.array(
      z
        .object({
          candidateId: uuidSchema,
          trackId: z.string(),
          start: z.number().int().positive(),
          end: z.number().int().positive(),
          category: categorySchema,
          label: z.string(),
          lane: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    generatedAt: isoInstantSchema,
  })
  .strict();

export const coverageVisualizationSchema = z
  .object({
    version: z.string(),
    populations: z.array(
      z
        .object({
          populationId: z.string(),
          label: z.string(),
          classMode: z.enum(['CLASS_I', 'CLASS_II', 'COMBINED']),
          coverage: measuredValueSchema,
          method: z.string().nullable(),
          observedAt: isoInstantSchema.nullable(),
        })
        .strict(),
    ),
    generatedAt: isoInstantSchema,
  })
  .strict();

export type GraphView = z.infer<typeof graphSchema>;
export type SequenceMapView = z.infer<typeof sequenceMapSchema>;
export type CoverageVisualization = z.infer<typeof coverageVisualizationSchema>;

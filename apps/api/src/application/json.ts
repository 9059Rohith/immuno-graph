import {
  canonicalJson,
  canonicalJsonSha256,
  type CanonicalJsonValue,
} from '@immunograph/algorithms';
import { profileMetadataSchema, type ProfileMetadata } from '@immunograph/database';
import {
  runConfigurationSchema,
  sourceStatusSchema,
  type NormalizedRunConfiguration,
  type RunConfiguration,
} from '@immunograph/shared';
import { z } from 'zod';

export interface StoredRunConfiguration {
  request: NormalizedRunConfiguration;
  profiles: {
    biologicalConstraints: ProfileMetadata;
    ranking: ProfileMetadata;
  };
}

const storedRunConfigurationSchema = z
  .object({
    request: runConfigurationSchema,
    profiles: z
      .object({
        biologicalConstraints: profileMetadataSchema,
        ranking: profileMetadataSchema,
      })
      .strict(),
  })
  .strict();

export const rawScoresSchema = z.object({ value: z.number().finite() }).passthrough();
export const evidenceDetailsSchema = z
  .object({ topReasons: z.array(z.string()).default([]) })
  .passthrough();
export const scoreMapSchema = z.record(z.number().finite());
export const coverageProvenanceSchema = z
  .object({ sourceStatus: sourceStatusSchema, method: z.string().min(1) })
  .passthrough();
export const graphNodePropertiesSchema = z
  .object({
    subtitle: z.string().nullable().default(null),
    status: z.string().nullable().default(null),
    sourceStatus: sourceStatusSchema.nullable().default(null),
    warningCode: z.string().nullable().default(null),
    detailLines: z.array(z.string()).default([]),
    position: z.object({ x: z.number(), y: z.number() }).strict().optional(),
  })
  .passthrough();
export const graphEdgePropertiesSchema = z
  .object({
    label: z.string().nullable().default(null),
    provenance: z.string().nullable().default(null),
  })
  .passthrough();

const uniqueSorted = (items: readonly string[]): string[] =>
  [...new Set(items.map((item) => item.trim()))].sort((left, right) => left.localeCompare(right));
const numericSorted = (items: readonly number[]): number[] =>
  [...new Set(items)].sort((a, b) => a - b);

export function normalizeRunConfiguration(input: RunConfiguration): NormalizedRunConfiguration {
  return runConfigurationSchema.parse({
    ...input,
    requestedExecutionMode: input.requestedExecutionMode ?? 'AUTO',
    analysis: {
      mhci: {
        ...input.analysis.mhci,
        alleles: uniqueSorted(input.analysis.mhci.alleles),
        peptideLengths: numericSorted(input.analysis.mhci.peptideLengths),
        methods: uniqueSorted(input.analysis.mhci.methods),
      },
      mhcii: {
        ...input.analysis.mhcii,
        alleles: uniqueSorted(input.analysis.mhcii.alleles),
        peptideLengths: numericSorted(input.analysis.mhcii.peptideLengths),
        methods: uniqueSorted(input.analysis.mhcii.methods),
      },
      bcell: {
        ...input.analysis.bcell,
        methods: uniqueSorted(input.analysis.bcell.methods),
      },
    },
    populations: uniqueSorted(input.populations),
    outputPreferences: {
      ...input.outputPreferences,
      formats: uniqueSorted(input.outputPreferences.formats),
      templateVersion: input.outputPreferences.templateVersion.trim(),
    },
  });
}

function canonicalValue(snapshot: StoredRunConfiguration): CanonicalJsonValue {
  return JSON.parse(JSON.stringify(snapshot)) as CanonicalJsonValue;
}

export function configurationHash(snapshot: StoredRunConfiguration): string {
  return canonicalJsonSha256(canonicalValue(snapshot));
}

export function serializeRunConfiguration(snapshot: StoredRunConfiguration): string {
  return canonicalJson(canonicalValue(snapshot));
}

export function parseStoredRunConfiguration(value: string): StoredRunConfiguration {
  return storedRunConfigurationSchema.parse(JSON.parse(value));
}

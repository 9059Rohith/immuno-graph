import { createHash } from 'node:crypto';

import type { z } from 'zod';

import {
  scientificBindingDataSchema,
  type ConnectorProvenance,
} from './scientific-workflow-contracts.js';

export const BINDING_CACHE_SCHEMA_VERSION = 'scientific-binding-cache-v1';

export interface BindingCacheKeyInput {
  proteinHash: string;
  candidateType: 'MHCI' | 'MHCII';
  alleles: readonly string[];
  peptideLengths: readonly number[];
  methods: readonly string[];
  ruleProfileVersion: string;
  rankingProfileVersion: string;
}

export type ScientificBindingResult = z.infer<typeof scientificBindingDataSchema>;

export function buildBindingCacheKey(input: BindingCacheKeyInput): string {
  return sha256Json({
    schemaVersion: BINDING_CACHE_SCHEMA_VERSION,
    proteinHash: input.proteinHash,
    candidateType: input.candidateType,
    alleles: [...new Set(input.alleles)].sort(),
    peptideLengths: [...new Set(input.peptideLengths)].sort((left, right) => left - right),
    methods: [...new Set(input.methods.map((method) => method.toLowerCase()))].sort(),
    ruleProfileVersion: input.ruleProfileVersion,
    rankingProfileVersion: input.rankingProfileVersion,
  });
}

export function cacheableLiveBindingResult(result: ScientificBindingResult): boolean {
  return (
    result.observations.length > 0 &&
    result.provenance.length > 0 &&
    result.provenance.every(
      (entry) =>
        entry.status === 'LIVE' &&
        (entry.predictionSource === undefined || entry.predictionSource === 'LIVE') &&
        entry.scientificUse !== false &&
        entry.validationStatus !== 'DEMONSTRATION_ONLY',
    )
  );
}

export function cachedBindingResult(
  stored: ScientificBindingResult,
  cacheKey: string,
): ScientificBindingResult {
  return scientificBindingDataSchema.parse({
    observations: stored.observations.map((observation) => ({ ...observation })),
    provenance: stored.provenance.map((entry) => cachedProvenance(entry, cacheKey)),
  });
}

function cachedProvenance(entry: ConnectorProvenance, cacheKey: string): ConnectorProvenance {
  return {
    ...entry,
    status: 'CACHED',
    predictionSource: 'CACHED',
    cacheKey,
    scientificUse: entry.scientificUse ?? true,
    validationStatus: entry.validationStatus ?? 'SCIENTIFIC',
  };
}

function sha256Json(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite cache-key number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  throw new Error('Unsupported cache-key value.');
}

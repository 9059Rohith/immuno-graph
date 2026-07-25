import { describe, expect, it } from 'vitest';

import {
  buildBindingCacheKey,
  cachedBindingResult,
  cacheableLiveBindingResult,
} from './prediction-cache.js';
import type { scientificBindingDataSchema } from './scientific-workflow-contracts.js';
import type { z } from 'zod';

type BindingResult = z.infer<typeof scientificBindingDataSchema>;

const liveResult: BindingResult = {
  observations: [
    {
      observationId: 'obs-1',
      candidateRef: 'candidate-1',
      candidateType: 'MHCI',
      peptide: 'ACDEFGHIK',
      start: 1,
      end: 9,
      length: 9,
      allele: 'HLA-A*02:01',
      method: 'iedb-recommended',
      methodVersion: '2023.09',
      rawScore: 0.8,
      percentileRank: 0.5,
      rawFields: { score: 0.8 },
    },
  ],
  provenance: [
    {
      connectorId: 'iedb',
      connectorVersion: 'tools-api-v1',
      method: 'iedb-recommended',
      methodVersion: '2023.09',
      status: 'LIVE',
      sourceUri: 'https://tools-cluster-interface.iedb.org/tools_api/mhci/',
      parameters: { candidateType: 'MHCI' },
      predictionSource: 'LIVE',
      scientificUse: true,
      validationStatus: 'SCIENTIFIC',
    },
  ],
};

describe('prediction cache helpers', () => {
  it('builds the same binding cache key for equivalent unordered inputs', () => {
    const left = buildBindingCacheKey({
      proteinHash: 'a'.repeat(64),
      candidateType: 'MHCI',
      alleles: ['HLA-B*07:02', 'HLA-A*02:01'],
      peptideLengths: [10, 9],
      methods: ['iedb-recommended'],
      ruleProfileVersion: 'mvp-v1.0',
      rankingProfileVersion: 'mvp-v1.0',
    });
    const right = buildBindingCacheKey({
      proteinHash: 'a'.repeat(64),
      candidateType: 'MHCI',
      alleles: ['HLA-A*02:01', 'HLA-B*07:02'],
      peptideLengths: [9, 10],
      methods: ['iedb-recommended'],
      ruleProfileVersion: 'mvp-v1.0',
      rankingProfileVersion: 'mvp-v1.0',
    });

    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns cached provenance without mutating the stored live payload', () => {
    const cached = cachedBindingResult(liveResult, 'b'.repeat(64));

    expect(cached.provenance).toEqual([
      expect.objectContaining({
        status: 'CACHED',
        predictionSource: 'CACHED',
        cacheKey: 'b'.repeat(64),
        scientificUse: true,
        validationStatus: 'SCIENTIFIC',
      }),
    ]);
    expect(liveResult.provenance[0]?.status).toBe('LIVE');
  });

  it('allows only complete live scientific binding results into the live cache', () => {
    expect(cacheableLiveBindingResult(liveResult)).toBe(true);
    expect(
      cacheableLiveBindingResult({
        ...liveResult,
        provenance: [
          {
            ...liveResult.provenance[0]!,
            status: 'SYNTHETIC',
            predictionSource: 'SYNTHETIC',
            scientificUse: false,
            validationStatus: 'DEMONSTRATION_ONLY',
          },
        ],
      }),
    ).toBe(false);
    expect(cacheableLiveBindingResult({ ...liveResult, observations: [] })).toBe(false);
  });
});

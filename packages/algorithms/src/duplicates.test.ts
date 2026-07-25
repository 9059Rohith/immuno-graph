import { describe, expect, it } from 'vitest';

import { detectDuplicates } from './duplicates.js';

describe('detectDuplicates', () => {
  it('deduplicates only complete positional identities', () => {
    const result = detectDuplicates([
      {
        id: 'record-b',
        proteinHash: 'protein',
        candidateType: 'MHCI',
        start: 1,
        end: 9,
        peptide: 'ACDEFGHIK',
        allele: 'HLA-A*02:01',
        observationRefs: ['obs-b'],
      },
      {
        id: 'record-a',
        proteinHash: 'protein',
        candidateType: 'MHCI',
        start: 1,
        end: 9,
        peptide: 'ACDEFGHIK',
        allele: 'HLA-A*02:01',
        observationRefs: ['obs-a'],
      },
      {
        id: 'different-position',
        proteinHash: 'protein',
        candidateType: 'MHCI',
        start: 20,
        end: 28,
        peptide: 'ACDEFGHIK',
        allele: 'HLA-A*02:01',
        observationRefs: ['obs-c'],
      },
    ]);

    expect(result.canonicalCandidates).toEqual([
      expect.objectContaining({
        id: 'record-a',
        observationRefs: ['obs-a', 'obs-b'],
      }),
      expect.objectContaining({
        id: 'different-position',
        observationRefs: ['obs-c'],
      }),
    ]);
    expect(result.duplicateLinks).toEqual([
      {
        duplicateId: 'record-b',
        canonicalId: 'record-a',
        edgeType: 'DUPLICATE_OF',
        ruleId: 'DUPLICATE-001',
      },
    ]);
  });

  it('preserves candidates when protein, track, coordinates, peptide, or allele differs', () => {
    const base = {
      proteinHash: 'p1',
      candidateType: 'MHCI' as const,
      start: 1,
      end: 9,
      peptide: 'ACDEFGHIK',
      allele: 'HLA-A*02:01',
      observationRefs: [] as string[],
    };
    const candidates = [
      { ...base, id: 'base' },
      { ...base, id: 'protein', proteinHash: 'p2' },
      { ...base, id: 'track', candidateType: 'MHCII' as const },
      { ...base, id: 'start', start: 2 },
      { ...base, id: 'end', end: 10 },
      { ...base, id: 'peptide', peptide: 'CDEFGHIKL' },
      { ...base, id: 'allele', allele: 'HLA-A*01:01' },
    ];

    expect(detectDuplicates(candidates).canonicalCandidates).toHaveLength(candidates.length);
  });

  it('does not mutate input candidates or observation arrays', () => {
    const observations = ['obs'];
    const candidate = {
      id: 'one',
      proteinHash: 'p',
      candidateType: 'BCELL' as const,
      start: 1,
      end: 3,
      peptide: 'ACD',
      observationRefs: observations,
    };
    detectDuplicates([candidate]);
    expect(candidate.observationRefs).toBe(observations);
    expect(observations).toEqual(['obs']);
  });
});

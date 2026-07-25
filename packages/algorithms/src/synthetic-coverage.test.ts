import { describe, expect, it } from 'vitest';

import { calculateSyntheticCoverage } from './synthetic-coverage.js';

describe('calculateSyntheticCoverage', () => {
  const frequencies = [
    {
      allele: 'HLA-A*01:01',
      populationId: 'GLOBAL',
      value: 0.1,
      sourceKind: 'SYNTHETIC' as const,
      scientificUse: false as const,
    },
    {
      allele: 'HLA-A*02:01',
      populationId: 'GLOBAL',
      value: 0.2,
      sourceKind: 'SYNTHETIC' as const,
      scientificUse: false as const,
    },
  ];

  it('deduplicates alleles and calculates deterministic Hardy-Weinberg carrier coverage', () => {
    expect(
      calculateSyntheticCoverage({
        populationId: 'GLOBAL',
        alleles: [' HLA-A*02:01 ', 'HLA-A*01:01', 'HLA-A*02:01'],
        frequencies,
      }),
    ).toEqual({
      projectedCoverage: 0.4816,
      averageHits: 0.55,
      alleleCarrierProbabilities: [
        { allele: 'HLA-A*01:01', carrierProbability: 0.19 },
        { allele: 'HLA-A*02:01', carrierProbability: 0.36 },
      ],
    });
  });

  it('returns null for empty, missing, wrong-population, and invalid frequency data', () => {
    expect(
      calculateSyntheticCoverage({ populationId: 'GLOBAL', alleles: [' '], frequencies }),
    ).toBeNull();
    expect(
      calculateSyntheticCoverage({
        populationId: 'GLOBAL',
        alleles: ['HLA-A*03:01'],
        frequencies,
      }),
    ).toBeNull();
    expect(
      calculateSyntheticCoverage({
        populationId: 'OTHER',
        alleles: ['HLA-A*01:01'],
        frequencies,
      }),
    ).toBeNull();
    for (const value of [-0.1, 1.1, Number.NaN]) {
      expect(
        calculateSyntheticCoverage({
          populationId: 'GLOBAL',
          alleles: ['HLA-A*01:01'],
          frequencies: [{ ...frequencies[0]!, value }],
        }),
      ).toBeNull();
    }
  });
});

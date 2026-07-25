import { describe, expect, it } from 'vitest';

import { generatePeptides } from './peptides.js';
import { predictSyntheticBinding } from './synthetic-prediction.js';

describe('predictSyntheticBinding', () => {
  const candidates = generatePeptides('ACDEFGHIKLMN', 'MHCI', [9]);
  const input = {
    proteinHash: 'a'.repeat(64),
    candidateType: 'MHCI' as const,
    candidates,
    alleles: [' HLA-A*02:01 ', 'HLA-A*01:01', 'HLA-A*02:01'],
    method: 'synthetic-binding',
    methodVersion: '1.0.0',
    datasetVersion: 'demo-v1',
  };

  it('is deterministic, sorted, bounded, and emits one observation per candidate/allele', () => {
    const first = predictSyntheticBinding(input);
    const second = predictSyntheticBinding(input);

    expect(second).toEqual(first);
    expect(first).toHaveLength(candidates.length * 2);
    expect(first.map(({ start, allele }) => `${start}:${allele}`)).toEqual([
      '1:HLA-A*01:01',
      '1:HLA-A*02:01',
      '2:HLA-A*01:01',
      '2:HLA-A*02:01',
      '3:HLA-A*01:01',
      '3:HLA-A*02:01',
      '4:HLA-A*01:01',
      '4:HLA-A*02:01',
    ]);
    for (const observation of first) {
      expect(observation.rawScore).toBeGreaterThanOrEqual(0);
      expect(observation.rawScore).toBeLessThanOrEqual(1);
      expect(observation.percentileRank).toBeGreaterThan(0);
      expect(observation.percentileRank).toBeLessThan(100);
      expect(observation.normalizedScore).toBeCloseTo(1 - observation.percentileRank / 100, 12);
      expect(observation.observationId).toMatch(/^[a-f0-9]{64}$/);
      expect(observation.candidateRef).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('rejects invalid hashes, mixed tracks, and empty alleles', () => {
    expect(() => predictSyntheticBinding({ ...input, proteinHash: 'bad' })).toThrow('SHA-256');
    expect(() =>
      predictSyntheticBinding({
        ...input,
        candidates: [{ ...candidates[0]!, candidateType: 'MHCII' }],
      }),
    ).toThrow('one requested track');
    expect(() => predictSyntheticBinding({ ...input, alleles: ['', ' '] })).toThrow(
      'at least one allele',
    );
  });

  it('changes its deterministic identity when scientific configuration changes', () => {
    const baseline = predictSyntheticBinding(input);
    const changed = predictSyntheticBinding({ ...input, datasetVersion: 'demo-v2' });
    expect(changed.map(({ observationId }) => observationId)).not.toEqual(
      baseline.map(({ observationId }) => observationId),
    );
  });
});

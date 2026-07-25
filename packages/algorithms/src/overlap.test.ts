import { describe, expect, it } from 'vitest';

import {
  calculateContainmentOverlap,
  detectOverlaps,
  resolveOverlaps,
  type OverlapCandidate,
} from './overlap.js';

const candidate = (overrides: Partial<OverlapCandidate>): OverlapCandidate => ({
  id: 'candidate',
  candidateKey: 'candidate',
  proteinHash: 'protein',
  candidateType: 'MHCI',
  allele: 'HLA-A*02:01',
  peptide: 'ACDEFGHIKL',
  start: 1,
  end: 10,
  length: 10,
  passesHardConstraints: true,
  preliminaryScore: 0.8,
  completeness: 1,
  agreement: 0.9,
  ...overrides,
});

describe('overlap algorithms', () => {
  it('calculates inclusive containment overlap at 0%, 80%, and greater than 80%', () => {
    expect(calculateContainmentOverlap({ start: 1, end: 5 }, { start: 6, end: 10 })).toBe(0);
    expect(calculateContainmentOverlap({ start: 1, end: 10 }, { start: 3, end: 12 })).toBe(0.8);
    expect(calculateContainmentOverlap({ start: 1, end: 10 }, { start: 2, end: 11 })).toBe(0.9);
  });

  it('uses a strict dominance threshold and never crosses allele boundaries', () => {
    const result = resolveOverlaps(
      [
        candidate({ id: 'exact-threshold', candidateKey: 'a', start: 3, end: 12 }),
        candidate({ id: 'base', candidateKey: 'b' }),
        candidate({
          id: 'other-allele',
          candidateKey: 'c',
          start: 2,
          end: 11,
          allele: 'HLA-A*01:01',
        }),
      ],
      0.8,
    );
    expect(result.retainedCandidateIds).toEqual(['exact-threshold', 'base', 'other-allele']);
    expect(result.rejections).toEqual([]);
  });

  it('detects ordered pairs and connected components without deciding dominance', () => {
    const result = detectOverlaps(
      [
        candidate({ id: 'a', candidateKey: 'a', start: 1, end: 10 }),
        candidate({ id: 'b', candidateKey: 'b', start: 2, end: 11 }),
        candidate({ id: 'c', candidateKey: 'c', start: 3, end: 12 }),
        candidate({ id: 'isolated', candidateKey: 'd', start: 30, end: 39 }),
      ],
      0.8,
    );

    expect(result.pairs).toEqual([
      { leftCandidateId: 'a', rightCandidateId: 'b', containmentOverlap: 0.9 },
      { leftCandidateId: 'b', rightCandidateId: 'c', containmentOverlap: 0.9 },
    ]);
    expect(result.components).toEqual([['a', 'b', 'c'], ['isolated']]);
  });

  it('resolves components with the documented dominance order', () => {
    const result = resolveOverlaps(
      [
        candidate({
          id: 'hard-fail-high-score',
          candidateKey: 'b',
          preliminaryScore: 0.99,
          passesHardConstraints: false,
        }),
        candidate({ id: 'winner', candidateKey: 'a', preliminaryScore: 0.8 }),
        candidate({
          id: 'lower-score',
          candidateKey: 'c',
          start: 2,
          end: 11,
          preliminaryScore: 0.7,
        }),
      ],
      0.8,
    );

    expect(result.retainedCandidateIds).toEqual(['winner']);
    expect(result.rejections).toEqual([
      {
        candidateId: 'hard-fail-high-score',
        retainedCandidateId: 'winner',
        ruleId: 'BIO-OVERLAP-001',
      },
      { candidateId: 'lower-score', retainedCandidateId: 'winner', ruleId: 'BIO-OVERLAP-001' },
    ]);
  });

  it('rejects invalid intervals and thresholds', () => {
    expect(() => calculateContainmentOverlap({ start: 2, end: 1 }, { start: 1, end: 2 })).toThrow();
    expect(() => resolveOverlaps([], 1.1)).toThrow();
  });
});

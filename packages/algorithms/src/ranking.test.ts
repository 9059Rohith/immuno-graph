import { describe, expect, it } from 'vitest';

import { calculateConfidence, rankCandidates, type FinalRankingCandidate } from './ranking.js';
import type { RuleOutcome } from './constraints.js';

const outcome = (
  ruleId: string,
  severity: 'HARD' | 'SOFT',
  status: RuleOutcome['outcome'],
): RuleOutcome => ({
  ruleId,
  ruleVersion: 'mvp-v1.0',
  severity,
  outcome: status,
  evidenceRefs: [],
  message: ruleId,
});

const candidate = (overrides: Partial<FinalRankingCandidate>): FinalRankingCandidate => ({
  candidateId: 'candidate',
  candidateKey: 'candidate',
  candidateType: 'MHCI',
  finalScore: 0.8,
  agreement: 0.9,
  completeness: 1,
  start: 1,
  blockingReviewCondition: false,
  ruleOutcomes: [],
  ...overrides,
});

describe('calculateConfidence', () => {
  it('returns HIGH with complete, agreeing evidence and fixture provenance only', () => {
    expect(
      calculateConfidence({
        category: 'RECOMMENDED',
        completeness: 1,
        agreement: 0.8,
        ruleOutcomes: [outcome('FIXTURE-PROVENANCE-001', 'SOFT', 'WARN')],
      }),
    ).toBe('HIGH');
  });

  it('returns MEDIUM, LOW, and NOT_APPLICABLE at their boundaries', () => {
    expect(
      calculateConfidence({
        category: 'REVIEW',
        completeness: 0.75,
        agreement: 0.6,
        ruleOutcomes: [outcome('DISAGREEMENT-001', 'SOFT', 'WARN')],
      }),
    ).toBe('MEDIUM');
    expect(
      calculateConfidence({
        category: 'REVIEW',
        completeness: 0.74,
        agreement: 0.9,
        ruleOutcomes: [],
      }),
    ).toBe('LOW');
    expect(
      calculateConfidence({
        category: 'REJECTED',
        completeness: 1,
        agreement: 1,
        ruleOutcomes: [],
      }),
    ).toBe('NOT_APPLICABLE');
  });
});

describe('rankCandidates', () => {
  it('categorizes at exact thresholds and applies stable track/category ranks', () => {
    const ranked = rankCandidates([
      candidate({ candidateId: 'rejected', candidateKey: 'f', finalScore: 0.499999 }),
      candidate({ candidateId: 'review', candidateKey: 'd', finalScore: 0.5 }),
      candidate({
        candidateId: 'blocked',
        candidateKey: 'c',
        finalScore: 0.9,
        blockingReviewCondition: true,
      }),
      candidate({ candidateId: 'recommended-low-agreement', candidateKey: 'b', agreement: 0.8 }),
      candidate({ candidateId: 'recommended', candidateKey: 'a', finalScore: 0.8 }),
      candidate({
        candidateId: 'hard-failed',
        candidateKey: 'e',
        finalScore: 0.99,
        ruleOutcomes: [outcome('BINDING-001', 'HARD', 'FAIL')],
      }),
      candidate({ candidateId: 'threshold', candidateKey: 'g', finalScore: 0.75 }),
    ]);

    expect(
      ranked.map(({ candidateId, category, trackRank, categoryRank }) => ({
        candidateId,
        category,
        trackRank,
        categoryRank,
      })),
    ).toEqual([
      { candidateId: 'recommended', category: 'RECOMMENDED', trackRank: 1, categoryRank: 1 },
      {
        candidateId: 'recommended-low-agreement',
        category: 'RECOMMENDED',
        trackRank: 2,
        categoryRank: 2,
      },
      { candidateId: 'threshold', category: 'RECOMMENDED', trackRank: 3, categoryRank: 3 },
      { candidateId: 'blocked', category: 'REVIEW', trackRank: 4, categoryRank: 1 },
      { candidateId: 'review', category: 'REVIEW', trackRank: 5, categoryRank: 2 },
      { candidateId: 'hard-failed', category: 'REJECTED', trackRank: 6, categoryRank: 1 },
      { candidateId: 'rejected', category: 'REJECTED', trackRank: 7, categoryRank: 2 },
    ]);
    expect(
      ranked
        .filter((item) => item.category === 'REJECTED')
        .every((item) => item.confidence === 'NOT_APPLICABLE'),
    ).toBe(true);
  });

  it('is independent of input order and rejects mixed tracks', () => {
    const left = candidate({ candidateId: 'left', candidateKey: 'a' });
    const right = candidate({ candidateId: 'right', candidateKey: 'b' });
    expect(rankCandidates([left, right])).toEqual(rankCandidates([right, left]));
    expect(() => rankCandidates([left, candidate({ candidateType: 'MHCII' })])).toThrow(
      'one track',
    );
  });

  it('rejects non-finite scores and invalid thresholds', () => {
    expect(() => rankCandidates([candidate({ finalScore: Number.POSITIVE_INFINITY })])).toThrow();
    expect(() =>
      rankCandidates([candidate({})], { recommendedMinimum: 0.4, reviewMinimum: 0.5 }),
    ).toThrow();
  });
});

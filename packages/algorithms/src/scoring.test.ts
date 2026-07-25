import { describe, expect, it } from 'vitest';

import { calculatePreliminaryScore } from './scoring.js';

describe('calculatePreliminaryScore', () => {
  it('uses frozen MVP T-cell weights and deterministic penalties', () => {
    const result = calculatePreliminaryScore({
      track: 'TCELL',
      bindingQuality: 0.8,
      consensusQuality: 0.7,
      candidateCoverage: 0.6,
      completeness: 1,
      missingOptionalWeightFraction: 0.5,
      softWarningCount: 1,
    });

    expect(result.scoreBeforePenalty).toBeCloseTo(0.75, 12);
    expect(result.missingEvidencePenalty).toBe(0.05);
    expect(result.softWarningPenalty).toBe(0.05);
    expect(result.fixturePenalty).toBe(0);
    expect(result.score).toBeCloseTo(0.65, 12);
  });

  it('uses frozen MVP B-cell weights', () => {
    const result = calculatePreliminaryScore({
      track: 'BCELL',
      predictorMean: 0.8,
      completeness: 0.5,
      missingOptionalWeightFraction: 0,
      softWarningCount: 0,
    });
    expect(result.scoreBeforePenalty).toBeCloseTo(0.77, 12);
    expect(result.score).toBeCloseTo(0.77, 12);
  });

  it('caps warning penalties and clamps the final score', () => {
    const result = calculatePreliminaryScore({
      track: 'BCELL',
      predictorMean: 0,
      completeness: 0,
      missingOptionalWeightFraction: 1,
      softWarningCount: 100,
    });
    expect(result.softWarningPenalty).toBe(0.2);
    expect(result.score).toBe(0);
  });

  it('rejects invalid components and warning counts', () => {
    expect(() =>
      calculatePreliminaryScore({
        track: 'TCELL',
        bindingQuality: Number.NaN,
        consensusQuality: 1,
        candidateCoverage: 1,
        completeness: 1,
        missingOptionalWeightFraction: 0,
        softWarningCount: 0,
      }),
    ).toThrow();
    expect(() =>
      calculatePreliminaryScore({
        track: 'BCELL',
        predictorMean: 1,
        completeness: 1,
        missingOptionalWeightFraction: 0,
        softWarningCount: -1,
      }),
    ).toThrow();
  });
});

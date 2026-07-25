import { describe, expect, it } from 'vitest';

import { calculateConsensus } from './consensus.js';

describe('calculateConsensus', () => {
  it('calculates weighted mean, population variance, agreement, completeness, and consensus', () => {
    const result = calculateConsensus(
      [
        { observationId: 'b', normalizedScore: 0.6, reliabilityWeight: 1, required: true },
        { observationId: 'a', normalizedScore: 0.8, reliabilityWeight: 1, required: true },
      ],
      2,
    );

    expect(result.weightedMean).toBeCloseTo(0.7, 12);
    expect(result.weightedVariance).toBeCloseTo(0.01, 12);
    expect(result.agreement).toBeCloseTo(0.96, 12);
    expect(result.completeness).toBe(1);
    expect(result.consensus).toBeCloseTo(0.6916, 12);
    expect(result.agreementStatus).toBe('SUFFICIENT_OBSERVATIONS');
  });

  it('marks a singleton as insufficient without inventing disagreement', () => {
    const result = calculateConsensus(
      [{ observationId: 'one', normalizedScore: 0.75, reliabilityWeight: 1, required: true }],
      2,
    );
    expect(result.agreement).toBe(1);
    expect(result.completeness).toBe(0.5);
    expect(result.agreementStatus).toBe('INSUFFICIENT_OBSERVATIONS');
  });

  it('supports non-negative zero-weight observations but requires positive total weight', () => {
    expect(() =>
      calculateConsensus(
        [{ observationId: 'zero', normalizedScore: 0.5, reliabilityWeight: 0, required: true }],
        1,
      ),
    ).toThrow('positive total reliability weight');
  });

  it('rejects out-of-range, non-finite, and invalid completeness inputs', () => {
    expect(() =>
      calculateConsensus(
        [{ observationId: 'bad', normalizedScore: 1.1, reliabilityWeight: 1, required: true }],
        1,
      ),
    ).toThrow();
    expect(() => calculateConsensus([], 0)).toThrow();
  });
});

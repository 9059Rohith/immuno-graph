import { describe, expect, it } from 'vitest';

import { clamp01, normalizeScore, tryNormalizeScore } from './normalization.js';

describe('score normalization', () => {
  it('clamps identity scores', () => {
    expect(clamp01(-1)).toBe(0);
    expect(
      normalizeScore(1.5, { kind: 'IDENTITY', min: 0, max: 1, direction: 'HIGHER_BETTER' }),
    ).toBe(1);
  });

  it('normalizes inverse percentile ranks', () => {
    expect(normalizeScore(1, { kind: 'INVERSE_PERCENTILE', cap: 2 })).toBe(0.5);
    expect(normalizeScore(4, { kind: 'INVERSE_PERCENTILE', cap: 2 })).toBe(0);
  });

  it('normalizes fixed ranges in both directions', () => {
    expect(
      normalizeScore(25, { kind: 'FIXED_MIN_MAX', min: 0, max: 100, direction: 'HIGHER_BETTER' }),
    ).toBe(0.25);
    expect(
      normalizeScore(25, { kind: 'FIXED_MIN_MAX', min: 0, max: 100, direction: 'LOWER_BETTER' }),
    ).toBe(0.75);
  });

  it('normalizes logistic profiles around the midpoint', () => {
    expect(
      normalizeScore(10, { kind: 'LOGISTIC', midpoint: 10, slope: 2, direction: 'HIGHER_BETTER' }),
    ).toBe(0.5);
    expect(
      normalizeScore(10, { kind: 'LOGISTIC', midpoint: 10, slope: 2, direction: 'LOWER_BETTER' }),
    ).toBe(0.5);
  });

  it('does not normalize unregistered fields and rejects invalid numbers/profiles', () => {
    expect(tryNormalizeScore(0.5, undefined)).toBeNull();
    expect(() => normalizeScore(Number.NaN, { kind: 'INVERSE_PERCENTILE', cap: 2 })).toThrow();
    expect(() =>
      normalizeScore(1, { kind: 'FIXED_MIN_MAX', min: 1, max: 1, direction: 'HIGHER_BETTER' }),
    ).toThrow();
  });
});

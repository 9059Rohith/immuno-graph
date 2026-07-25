import { describe, expect, it } from 'vitest';

import {
  sliceByOneBasedInterval,
  toOneBasedInclusive,
  toZeroBasedHalfOpen,
} from './coordinates.js';

describe('coordinate conversion', () => {
  it('round-trips one-based inclusive coordinates', () => {
    const internal = toZeroBasedHalfOpen({ start: 1, end: 4 });
    expect(internal).toEqual({ start: 0, endExclusive: 4 });
    expect(toOneBasedInclusive(internal)).toEqual({ start: 1, end: 4 });
    expect(sliceByOneBasedInterval('ACDEFG', { start: 2, end: 5 })).toBe('CDEF');
  });

  it.each([
    { start: 0, end: 1 },
    { start: 3, end: 2 },
    { start: 1.5, end: 2 },
  ])('rejects invalid public interval $start..$end', (interval) => {
    expect(() => toZeroBasedHalfOpen(interval)).toThrow(RangeError);
  });

  it.each([
    { start: -1, endExclusive: 1 },
    { start: 2, endExclusive: 2 },
    { start: 0, endExclusive: 1.5 },
  ])('rejects invalid internal interval', (interval) => {
    expect(() => toOneBasedInclusive(interval)).toThrow(RangeError);
  });

  it('rejects an interval beyond the sequence', () => {
    expect(() => sliceByOneBasedInterval('ACD', { start: 2, end: 4 })).toThrow(
      'exceeds sequence length',
    );
  });
});

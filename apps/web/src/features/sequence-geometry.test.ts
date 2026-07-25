import { describe, expect, it } from 'vitest';

import { sequenceSegmentGeometry } from './sequence-geometry';

describe('sequence display geometry', () => {
  it('maps inclusive one-based coordinates to a bounded view box', () => {
    expect(sequenceSegmentGeometry(1, 10, 100)).toEqual({ x: 0, width: 100 });
    expect(sequenceSegmentGeometry(91, 100, 100)).toEqual({ x: 900, width: 100 });
  });

  it('keeps single residue segments visible without changing their identity', () => {
    const geometry = sequenceSegmentGeometry(50, 50, 10_000);
    expect(geometry.x).toBeCloseTo(4.9);
    expect(geometry.width).toBe(2);
  });
});

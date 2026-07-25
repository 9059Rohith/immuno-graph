import { describe, expect, it } from 'vitest';

import { canonicalJson, canonicalJsonSha256 } from './canonical-json.js';

describe('canonical JSON', () => {
  it('sorts object keys recursively while preserving array order', () => {
    expect(canonicalJson({ z: 1, a: { d: 4, b: 2 }, values: [3, 1] })).toBe(
      '{"a":{"b":2,"d":4},"values":[3,1],"z":1}',
    );
    expect(canonicalJsonSha256({ b: 2, a: 1 })).toBe(canonicalJsonSha256({ a: 1, b: 2 }));
  });

  it('rejects non-finite and non-JSON values', () => {
    expect(() => canonicalJson({ value: Number.NaN })).toThrow();
    expect(() => canonicalJson({ value: undefined } as never)).toThrow();
  });
});

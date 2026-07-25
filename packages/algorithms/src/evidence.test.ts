import { describe, expect, it } from 'vitest';

import { assertCompatibleEvidence, checkEvidenceCompatibility } from './evidence.js';

const base = {
  proteinHash: 'a'.repeat(64),
  candidateType: 'MHCI' as const,
  start: 1,
  end: 9,
  sequence: 'ACDEFGHIK',
  allele: 'HLA-A*02:01',
  targetSemantics: 'binding-affinity',
};

describe('evidence compatibility', () => {
  it('accepts identical scientific grouping keys', () => {
    expect(checkEvidenceCompatibility(base, { ...base })).toEqual({
      compatible: true,
      mismatchedFields: [],
    });
    expect(() => assertCompatibleEvidence([base, { ...base }])).not.toThrow();
  });

  it.each([
    ['proteinHash', 'b'.repeat(64)],
    ['candidateType', 'MHCII'],
    ['start', 2],
    ['end', 10],
    ['sequence', 'CDEFGHIKL'],
    ['allele', 'HLA-A*01:01'],
    ['targetSemantics', 'presentation'],
  ] as const)('reports a %s mismatch', (field, value) => {
    const result = checkEvidenceCompatibility(base, { ...base, [field]: value });
    expect(result.compatible).toBe(false);
    expect(result.mismatchedFields).toContain(field);
    expect(() => assertCompatibleEvidence([base, { ...base, [field]: value }])).toThrow(
      'Incompatible evidence',
    );
  });

  it('treats absent and null alleles equivalently', () => {
    const bcell = {
      proteinHash: base.proteinHash,
      candidateType: 'BCELL' as const,
      start: base.start,
      end: base.end,
      sequence: base.sequence,
      targetSemantics: base.targetSemantics,
    };
    expect(checkEvidenceCompatibility(bcell, { ...bcell, allele: null }).compatible).toBe(true);
  });
});

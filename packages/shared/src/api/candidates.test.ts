import { describe, expect, it } from 'vitest';

import { sourceStatusSchema } from './common.js';
import { candidateComparisonSchema } from './candidates.js';

const candidateId = '00000000-0000-4000-8000-000000000001';

describe('candidate comparison contract', () => {
  const comparison = {
    track: 'MHCI',
    candidates: [
      {
        id: candidateId,
        peptide: 'YLQPRTFLL',
        rank: 1,
        finalScore: 0.91,
        confidence: 'HIGH',
        category: 'RECOMMENDED',
      },
    ],
    components: [{ name: 'Binding', values: { [candidateId]: 0.95 } }],
    constraints: [
      {
        ruleId: 'binding-minimum',
        label: 'Binding minimum',
        outcomes: { [candidateId]: 'PASS' },
      },
    ],
  };

  it('accepts aligned component and constraint maps', () => {
    expect(candidateComparisonSchema.parse(comparison)).toEqual(comparison);
  });

  it('rejects undocumented response fields', () => {
    expect(() =>
      candidateComparisonSchema.parse({ ...comparison, explanation: 'extra' }),
    ).toThrow();
  });
});

describe('scientific source status contract', () => {
  it('accepts an explicitly synthetic demonstration source', () => {
    expect(sourceStatusSchema.parse('SYNTHETIC')).toBe('SYNTHETIC');
  });
});

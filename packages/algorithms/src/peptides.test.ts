import { describe, expect, it } from 'vitest';

import { generatePeptides } from './peptides.js';

describe('generatePeptides', () => {
  it('emits one-based inclusive windows in canonical order', () => {
    expect(generatePeptides('ACDEF', 'MHCI', [3, 2])).toEqual([
      { candidateType: 'MHCI', start: 1, end: 2, length: 2, peptide: 'AC' },
      { candidateType: 'MHCI', start: 1, end: 3, length: 3, peptide: 'ACD' },
      { candidateType: 'MHCI', start: 2, end: 3, length: 2, peptide: 'CD' },
      { candidateType: 'MHCI', start: 2, end: 4, length: 3, peptide: 'CDE' },
      { candidateType: 'MHCI', start: 3, end: 4, length: 2, peptide: 'DE' },
      { candidateType: 'MHCI', start: 3, end: 5, length: 3, peptide: 'DEF' },
      { candidateType: 'MHCI', start: 4, end: 5, length: 2, peptide: 'EF' },
    ]);
  });

  it('skips lengths longer than the sequence and removes duplicate configured lengths', () => {
    expect(generatePeptides('ACD', 'MHCII', [4, 3, 3])).toEqual([
      { candidateType: 'MHCII', start: 1, end: 3, length: 3, peptide: 'ACD' },
    ]);
  });

  it('rejects B-cell sliding windows and invalid lengths', () => {
    expect(() => generatePeptides('ACDE', 'BCELL', [2])).toThrow('B-cell');
    expect(() => generatePeptides('ACDE', 'MHCI', [0])).toThrow('positive integers');
  });
});

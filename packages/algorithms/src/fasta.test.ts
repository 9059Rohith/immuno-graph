import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { validateFasta } from './fasta.js';

describe('validateFasta', () => {
  it('normalizes one protein record and hashes its sequence', () => {
    const result = validateFasta('\uFEFF> protein-1\r\n ac dE \r\n*\r\n');

    expect(result).toEqual({
      ok: true,
      value: {
        header: ' protein-1',
        normalizedSequence: 'ACDE',
        sequenceLength: 4,
        sha256: createHash('sha256').update('ACDE').digest('hex'),
      },
    });
  });

  it.each([
    ['missing header', 'ACDE', 'FASTA_HEADER_REQUIRED'],
    ['multiple records', '>one\nACDE\n>two\nFGHI', 'FASTA_MULTIPLE_RECORDS'],
    ['internal stop', '>one\nAC*DE', 'FASTA_INTERNAL_STOP'],
    ['ambiguous residue', '>one\nACDX', 'FASTA_INVALID_RESIDUE'],
    ['empty sequence', '>one\n', 'FASTA_SEQUENCE_REQUIRED'],
  ])('rejects %s', (_name, input, code) => {
    const result = validateFasta(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe(code);
  });

  it('identifies nucleotide-like input before generic alphabet rejection', () => {
    const result = validateFasta(`>dna\n${'ACGTUN'.repeat(5)}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('SEQUENCE_APPEARS_NUCLEOTIDE');
  });

  it('enforces byte and residue limits', () => {
    const tooLarge = validateFasta('>p\nACDE', { maxBytes: 4 });
    const tooLong = validateFasta('>p\nACDE', { maxResidues: 3 });
    expect(!tooLarge.ok && tooLarge.errors[0]?.code).toBe('FASTA_TOO_LARGE');
    expect(!tooLong.ok && tooLong.errors[0]?.code).toBe('FASTA_SEQUENCE_TOO_LONG');
  });
});

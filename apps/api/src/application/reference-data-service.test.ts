import { loadReferenceBundle } from '@immunograph/database';
import { describe, expect, it } from 'vitest';

import { ReferenceDataService } from './reference-data-service.js';

describe('ReferenceDataService', () => {
  it('derives the strict FASTA options from committed reference data', async () => {
    const service = new ReferenceDataService(loadReferenceBundle());

    await expect(service.fastaValidationOptions()).resolves.toEqual({
      alphabet: [...'ACDEFGHIKLMNPQRSTVWY'],
      maxBytes: 1_048_576,
      maxResidues: 10_000,
    });
  });

  it('canonicalizes a registered HLA alias and validates its method and peptide lengths', async () => {
    const service = new ReferenceDataService(loadReferenceBundle());

    await expect(
      service.validateTrack({
        candidateType: 'MHCI',
        alleles: ['A*02:01'],
        methods: ['iedb-recommended'],
        peptideLengths: [9, 10],
      }),
    ).resolves.toEqual({
      alleles: ['HLA-A*02:01'],
      methods: ['iedb-recommended'],
      peptideLengths: [9, 10],
    });
  });

  it.each([
    [
      'unknown allele',
      {
        candidateType: 'MHCI',
        alleles: ['HLA-A*99:99'],
        methods: ['iedb-recommended'],
        peptideLengths: [9],
      },
      'UNSUPPORTED_ALLELE',
    ],
    [
      'class mismatch',
      {
        candidateType: 'MHCII',
        alleles: ['HLA-A*02:01'],
        methods: ['iedb-recommended'],
        peptideLengths: [15],
      },
      'UNSUPPORTED_ALLELE',
    ],
    [
      'method mismatch',
      {
        candidateType: 'MHCI',
        alleles: ['HLA-A*02:01'],
        methods: ['unregistered'],
        peptideLengths: [9],
      },
      'UNSUPPORTED_METHOD',
    ],
    [
      'length mismatch',
      {
        candidateType: 'MHCI',
        alleles: ['HLA-A*02:01'],
        methods: ['iedb-recommended'],
        peptideLengths: [15],
      },
      'UNSUPPORTED_PEPTIDE_LENGTH',
    ],
  ] as const)('rejects %s before workflow creation', async (_name, track, code) => {
    const service = new ReferenceDataService(loadReferenceBundle());

    await expect(service.validateTrack(track)).rejects.toMatchObject({ code, statusCode: 422 });
  });

  it('does not invent a zero frequency when a population is absent', async () => {
    const service = new ReferenceDataService(loadReferenceBundle());

    await expect(
      service.populationFrequency('HLA-A*02:01', 'synthetic:missing'),
    ).resolves.toBeNull();
  });
});

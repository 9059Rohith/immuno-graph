import { describe, expect, it } from 'vitest';

import {
  DL_MODEL_ID,
  ML_MODEL_ID,
  extractBindingFeatures,
  predictBindingModels,
} from './model-predictors.js';

describe('deterministic dual-head demonstration scorer', () => {
  const input = { peptide: 'GILGFVFTL', allele: 'HLA-A*02:01', candidateType: 'MHCI' as const };

  it('is deterministic, bounded, and exposes both scoring heads', () => {
    const first = predictBindingModels(input);
    expect(predictBindingModels(input)).toEqual(first);
    expect(first.mlScore).toBeGreaterThanOrEqual(0);
    expect(first.mlScore).toBeLessThanOrEqual(1);
    expect(first.dlScore).toBeGreaterThanOrEqual(0);
    expect(first.dlScore).toBeLessThanOrEqual(1);
    expect(first.ensembleScore).toBeGreaterThanOrEqual(0);
    expect(first.ensembleScore).toBeLessThanOrEqual(1);
    expect(ML_MODEL_ID).toContain('deterministic-linear-demo-head');
    expect(DL_MODEL_ID).toContain('deterministic-nonlinear-demo-head');
  });

  it('extracts a fixed-size feature vector and reacts to sequence changes', () => {
    expect(extractBindingFeatures(input)).toHaveLength(18);
    expect(extractBindingFeatures({ ...input, peptide: 'DEDEDEDE' })).not.toEqual(
      extractBindingFeatures(input),
    );
  });

  it('rejects malformed peptides', () => {
    expect(() => predictBindingModels({ ...input, peptide: 'ABC123' })).toThrow(
      'canonical amino acids',
    );
  });

  it('stays finite and bounded across the complete supported residue alphabet', () => {
    const residues = 'ACDEFGHIKLMNPQRSTVWY';
    for (const candidateType of ['MHCI', 'MHCII'] as const) {
      for (const allele of ['HLA-A*02:01', 'HLA-B*07:02', 'HLA-DRB1*04:01']) {
        const result = predictBindingModels({
          peptide: residues.slice(0, candidateType === 'MHCI' ? 9 : 20),
          allele,
          candidateType,
        });
        for (const score of Object.values(result)) {
          expect(Number.isFinite(score)).toBe(true);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('normalizes lowercase input without changing the prediction', () => {
    expect(predictBindingModels({ ...input, peptide: input.peptide.toLowerCase() })).toEqual(
      predictBindingModels(input),
    );
  });

  it('handles repeated inference without state leakage', () => {
    const baseline = predictBindingModels(input);
    for (let index = 0; index < 2_000; index += 1) {
      expect(
        predictBindingModels({ ...input, peptide: `${input.peptide}${index % 2 ? 'A' : 'G'}` }),
      ).toEqual(
        predictBindingModels({ ...input, peptide: `${input.peptide}${index % 2 ? 'A' : 'G'}` }),
      );
    }
    expect(predictBindingModels(input)).toEqual(baseline);
  });
});

import { describe, expect, it } from 'vitest';

import { evaluateBaseHardConstraints } from './constraints.js';

const validInput = {
  candidateType: 'MHCI' as const,
  peptideLength: 9,
  allele: 'HLA-A*02:01',
  allowedLengths: { MHCI: [8, 9, 10, 11], MHCII: [13, 14, 15] },
  supportedAlleles: ['HLA-A*02:01'],
  requiredEvidenceRefs: ['binding-1'],
  presentEvidenceRefs: ['binding-1'],
  bindingObservations: [{ evidenceRef: 'binding-1', percentileRank: 1.5, required: true }],
  bindingPercentileRankMaximum: 2,
};

describe('evaluateBaseHardConstraints', () => {
  it('passes valid MHC length, allele, evidence, and binding rules in fixed order', () => {
    const result = evaluateBaseHardConstraints(validInput);
    expect(result.passesAllHardConstraints).toBe(true);
    expect(result.outcomes.map(({ ruleId, outcome }) => ({ ruleId, outcome }))).toEqual([
      { ruleId: 'SEQ-LENGTH-001', outcome: 'PASS' },
      { ruleId: 'HLA-SUPPORTED-001', outcome: 'PASS' },
      { ruleId: 'EVIDENCE-REQUIRED-001', outcome: 'PASS' },
      { ruleId: 'BINDING-001', outcome: 'PASS' },
    ]);
  });

  it('reports every independent hard failure', () => {
    const result = evaluateBaseHardConstraints({
      ...validInput,
      peptideLength: 12,
      allele: 'HLA-A*99:99',
      presentEvidenceRefs: [],
      bindingObservations: [{ evidenceRef: 'binding-1', percentileRank: 2.1, required: true }],
    });
    expect(result.passesAllHardConstraints).toBe(false);
    expect(result.outcomes.every((outcome) => outcome.outcome === 'FAIL')).toBe(true);
    expect(result.outcomes.every((outcome) => outcome.severity === 'HARD')).toBe(true);
  });

  it('marks MHC-specific length, HLA, and binding rules not evaluated for B-cell regions', () => {
    const result = evaluateBaseHardConstraints({
      ...validInput,
      candidateType: 'BCELL',
      peptideLength: 20,
      allele: undefined,
      requiredEvidenceRefs: [],
      presentEvidenceRefs: [],
      bindingObservations: [],
    });
    expect(result.outcomes.map((outcome) => outcome.outcome)).toEqual([
      'NOT_EVALUATED',
      'NOT_EVALUATED',
      'PASS',
      'NOT_EVALUATED',
    ]);
    expect(result.passesAllHardConstraints).toBe(true);
  });

  it('rejects non-finite binding values and invalid thresholds', () => {
    expect(() =>
      evaluateBaseHardConstraints({ ...validInput, bindingPercentileRankMaximum: 0 }),
    ).toThrow();
    expect(() =>
      evaluateBaseHardConstraints({
        ...validInput,
        bindingObservations: [
          { evidenceRef: 'binding-1', percentileRank: Number.NaN, required: true },
        ],
      }),
    ).toThrow();
  });
});

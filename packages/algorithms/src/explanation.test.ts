import { describe, expect, it } from 'vitest';

import { explainCandidate } from './explanation.js';

describe('explainCandidate', () => {
  it('produces a deterministic evidence-grounded explanation', () => {
    const result = explainCandidate({
      audience: 'JUDGE',
      candidateKey: 'MHCI:1:9:HLA-A*02:01',
      category: 'RECOMMENDED',
      trackRank: 1,
      finalScore: 0.82,
      componentScores: { completeness: 1, binding: 0.9, consensus: 0.8 },
      ruleOutcomes: [
        { ruleId: 'FIXTURE-PROVENANCE-001', outcome: 'WARN' },
        { ruleId: 'BINDING-001', outcome: 'PASS' },
      ],
      provenanceStatuses: ['FIXTURE', 'LIVE', 'LIVE'],
    });

    expect(result.strongestComponent).toEqual({ name: 'completeness', value: 1 });
    expect(result.warningRuleIds).toEqual(['FIXTURE-PROVENANCE-001']);
    expect(result.provenanceSummary).toEqual({ FIXTURE: 1, LIVE: 2 });
    expect(result.text).toContain('RECOMMENDED');
    expect(result.text).toContain('computational decision support');
  });

  it('uses lexical component tie-breaking and rejects invalid scores', () => {
    const input = {
      audience: 'RESEARCHER' as const,
      candidateKey: 'candidate',
      category: 'REVIEW' as const,
      trackRank: 2,
      finalScore: 0.6,
      componentScores: { zeta: 0.8, alpha: 0.8 },
      ruleOutcomes: [],
      provenanceStatuses: [],
    };
    expect(explainCandidate(input).strongestComponent?.name).toBe('alpha');
    expect(() => explainCandidate({ ...input, finalScore: Number.NaN })).toThrow();
  });
});

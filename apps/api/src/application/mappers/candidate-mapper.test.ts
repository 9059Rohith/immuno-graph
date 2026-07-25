import { describe, expect, it } from 'vitest';

import { candidateListSchema, coverageSchema } from '@immunograph/shared';

import { mapCandidatePage, mapCoverage } from './candidate-mapper.js';

describe('candidate mapper', () => {
  it('maps missing evidence as unavailable rather than zero', () => {
    const candidateId = '00000000-0000-4000-8000-000000000005';
    const record = {
      id: 'ranking-id',
      runId: 'run-id',
      candidateId,
      snapshotHash: 'a'.repeat(64),
      profileVersion: 'mvp-v1.0',
      track: 'MHCI',
      componentScoresJson: '{"binding":0.8}',
      penaltiesJson: '{}',
      finalScore: 0.8,
      category: 'RECOMMENDED',
      confidence: 0.9,
      rank: 1,
      createdAt: new Date('2026-07-24T00:00:00.000Z'),
      candidate: {
        id: candidateId,
        runId: 'run-id',
        candidateKey: 'key',
        candidateType: 'MHCI',
        peptide: 'ACDEFGHIK',
        start: 1,
        end: 9,
        length: 9,
        allele: 'HLA-A*02:01',
        createdAt: new Date('2026-07-24T00:00:00.000Z'),
        constraintOutcomes: [],
        evidenceSummaries: [],
        predictionObservations: [],
      },
    };
    const mapped = mapCandidatePage([record], [], 'a'.repeat(64), null);
    expect(candidateListSchema.parse(mapped)).toEqual(mapped);
    expect(mapped.items[0]?.predictorScore).toEqual({
      value: null,
      unavailableReason: 'Binding score unavailable',
      sourceStatus: null,
    });
  });

  it('maps absent coverage as unavailable', () => {
    const mapped = mapCoverage(
      { populationId: 'INDIA', purpose: 'CANDIDATE_RANKING', candidateId: null },
      null,
    );
    expect(coverageSchema.parse(mapped)).toEqual(mapped);
    expect(mapped.coverage.value).toBeNull();
  });
});

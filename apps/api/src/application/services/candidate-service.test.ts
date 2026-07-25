import { describe, expect, it } from 'vitest';

import { CandidateService } from './candidate-service.js';

const runId = '00000000-0000-4000-8000-000000000001';
const snapshotHash = 'a'.repeat(64);

function ranking(candidateId: string, start: number, rank: number) {
  return {
    id: `ranking-${rank}`,
    runId,
    candidateId,
    snapshotHash,
    profileVersion: 'mvp-v1.0',
    track: 'MHCI',
    componentScoresJson: '{"binding":0.8}',
    penaltiesJson: '{}',
    finalScore: 0.8,
    category: 'RECOMMENDED',
    confidence: 0.9,
    rank,
    createdAt: new Date(),
    candidate: {
      id: candidateId,
      runId,
      candidateKey: `key-${start}`,
      candidateType: 'MHCI',
      peptide: 'ACDEFGHIK',
      start,
      end: start + 8,
      length: 9,
      allele: 'HLA-A*02:01',
      createdAt: new Date(),
      constraintOutcomes: [],
      evidenceSummaries: [],
      predictionObservations: [],
    },
  };
}

describe('CandidateService', () => {
  it('returns positional duplicates as distinct stored candidates', async () => {
    const records = [
      ranking('00000000-0000-4000-8000-000000000011', 1, 1),
      ranking('00000000-0000-4000-8000-000000000012', 2, 2),
    ];
    const repositories = {
      runs: { findById: async () => ({ id: runId }) },
      rankingResults: { findLatestSnapshotHash: async () => snapshotHash },
      candidates: { listRanked: async () => ({ items: records, nextCursor: null }) },
      populationCoverageResults: { listByRun: async () => [] },
    };
    const service = new CandidateService(repositories as never);
    const result = await service.list({ runId, sort: 'rank', limit: 50 });
    expect(result.items).toHaveLength(2);
    expect(result.items.map(({ start }) => start)).toEqual([1, 2]);
  });

  it('returns missing coverage as unavailable and rejects B-cell shortlist requests', async () => {
    const repositories = {
      runs: { findById: async () => ({ id: runId }) },
      populationCoverageResults: { findMatch: async () => null },
    };
    const service = new CandidateService(repositories as never);
    await expect(
      service.coverage({ runId, populationId: 'INDIA', purpose: 'CANDIDATE_RANKING' }),
    ).resolves.toMatchObject({ coverage: { value: null } });
    await expect(
      service.shortlistOptimization({ runId, track: 'BCELL' as never }),
    ).rejects.toMatchObject({
      code: 'INVALID_COVERAGE_TRACK',
      statusCode: 422,
    });
  });
});

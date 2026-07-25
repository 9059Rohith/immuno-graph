import { describe, expect, it } from 'vitest';

import {
  applyFrozenConsensusRankingModel,
  calibrateEvidenceConfidence,
  optimizeMultiEpitopeConstruct,
  type ConstructCandidate,
} from './construct-optimization.js';

const candidate = (overrides: Partial<ConstructCandidate>): ConstructCandidate => ({
  candidateId: 'candidate-1',
  candidateType: 'MHCI',
  peptide: 'ACDEFGHIK',
  start: 1,
  end: 9,
  rank: 1,
  finalScore: 0.8,
  agreement: 0.8,
  completeness: 1,
  category: 'RECOMMENDED',
  populationCoverage: { INDIA: 0.2, EUROPE: 0.1 },
  ...overrides,
});

describe('applyFrozenConsensusRankingModel', () => {
  it('returns a versioned deterministic priority score with explicit contributions', () => {
    const ranked = applyFrozenConsensusRankingModel({
      binding: 0.9,
      consensus: 0.7,
      populationCoverage: 0.5,
      completeness: 1,
      evidenceAgreement: 0.8,
      redundancyPenalty: 0.1,
    });

    expect(ranked.modelId).toBe('immunograph-frozen-consensus-ranker');
    expect(ranked.modelType).toBe('FROZEN_LINEAR_MODEL');
    expect(ranked.scientificUse).toBe(false);
    expect(ranked.priorityScore).toBeCloseTo(0.69, 10);
    expect(ranked.contributions.map((item) => item.feature)).toEqual([
      'binding',
      'consensus',
      'populationCoverage',
      'completeness',
      'evidenceAgreement',
      'redundancyPenalty',
    ]);
  });
});

describe('calibrateEvidenceConfidence', () => {
  it('calibrates confidence from evidence quality instead of mirroring final score', () => {
    expect(
      calibrateEvidenceConfidence({
        finalScore: 0.95,
        agreement: 0.3,
        completeness: 1,
        evidenceCount: 1,
        sourceStatuses: ['SYNTHETIC'],
      }),
    ).toMatchObject({
      label: 'LOW',
      calibrationMethod: 'deterministic-evidence-quality-bins',
      scientificUse: false,
    });

    expect(
      calibrateEvidenceConfidence({
        finalScore: 0.86,
        agreement: 0.86,
        completeness: 1,
        evidenceCount: 3,
        sourceStatuses: ['LIVE', 'CACHED'],
      }),
    ).toMatchObject({ label: 'HIGH' });
  });
});

describe('optimizeMultiEpitopeConstruct', () => {
  it('uses deterministic GA selection to maximize coverage and minimize redundant epitopes', () => {
    const input = {
      track: 'MHCI' as const,
      candidates: [
        candidate({
          candidateId: 'broad-high',
          peptide: 'ACDEFGHIK',
          start: 1,
          end: 9,
          finalScore: 0.78,
          populationCoverage: { INDIA: 0.45, EUROPE: 0.3 },
        }),
        candidate({
          candidateId: 'broad-medium',
          peptide: 'KLMNPQRST',
          start: 30,
          end: 38,
          rank: 2,
          finalScore: 0.75,
          populationCoverage: { INDIA: 0.3, EUROPE: 0.35 },
        }),
        candidate({
          candidateId: 'redundant-high',
          peptide: 'ACDEFGHIK',
          start: 2,
          end: 10,
          rank: 3,
          finalScore: 0.92,
          populationCoverage: { INDIA: 0.44, EUROPE: 0.29 },
        }),
        candidate({
          candidateId: 'narrow-top',
          peptide: 'TVWYACDEF',
          start: 70,
          end: 78,
          rank: 4,
          finalScore: 0.95,
          populationCoverage: { INDIA: 0.02, EUROPE: 0.01 },
        }),
      ],
      populationWeights: { INDIA: 0.6, EUROPE: 0.4 },
      maximumShortlistSize: 2,
      targetCoverage: 0.58,
      seed: 'stable-demo',
      generations: 24,
      populationSize: 16,
    };

    const first = optimizeMultiEpitopeConstruct(input);
    const second = optimizeMultiEpitopeConstruct(input);

    expect(first).toEqual(second);
    expect(first.algorithmId).toBe('deterministic-genetic-construct-optimizer');
    expect(first.selectedCandidateIds).toEqual(['broad-high', 'broad-medium']);
    expect(first.selectedCandidateIds).not.toContain('redundant-high');
    expect(first.finalCoverage).toBeGreaterThanOrEqual(0.58);
    expect(first.redundancyPenalty).toBeLessThan(0.1);
    expect(first.constructSequence).toBe('ACDEFGHIKGPGPGKLMNPQRST');
    expect(first.manufacturability.status).toBe('PASS');
  });

  it('returns a safe empty result when no selectable candidates are available', () => {
    const optimized = optimizeMultiEpitopeConstruct({
      track: 'MHCII',
      candidates: [candidate({ candidateId: 'rejected', category: 'REJECTED' })],
      populationWeights: { INDIA: 1 },
      maximumShortlistSize: 3,
      seed: 'empty',
    });

    expect(optimized.selectedCandidateIds).toEqual([]);
    expect(optimized.finalCoverage).toBe(0);
    expect(optimized.manufacturability.status).toBe('WARN');
  });
});

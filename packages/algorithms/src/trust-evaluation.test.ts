import { describe, expect, it } from 'vitest';

import { evaluateTrust, type TrustEvaluationInput } from './trust-evaluation.js';

const validInput: TrustEvaluationInput = {
  fixtureManifestValid: true,
  provenance: { total: 3, complete: 3 },
  constraintOutcomeCount: 12,
  configurationApproved: true,
  shortlistApproved: true,
  runFinished: true,
  artifactHashes: ['a'.repeat(64), 'b'.repeat(64)],
  abstentionCount: 4,
};

describe('evaluateTrust', () => {
  it('passes every independently inspectable trust check for a complete run', () => {
    expect(evaluateTrust(validInput).map(({ id }) => id)).toEqual([
      'fixture_manifest_valid',
      'provenance_complete',
      'constraints_enforced',
      'approval_gate',
      'artifact_hashes',
      'abstention_visible',
    ]);
    expect(evaluateTrust(validInput).every(({ status }) => status === 'PASS')).toBe(true);
  });

  it('reports unavailable evidence instead of manufacturing a pass', () => {
    expect(evaluateTrust({ ...validInput, artifactHashes: [] })).toContainEqual(
      expect.objectContaining({ id: 'artifact_hashes', status: 'UNAVAILABLE' }),
    );
    expect(
      evaluateTrust({
        ...validInput,
        runFinished: false,
        constraintOutcomeCount: 0,
        abstentionCount: 0,
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'constraints_enforced', status: 'UNAVAILABLE' }),
        expect.objectContaining({ id: 'abstention_visible', status: 'UNAVAILABLE' }),
      ]),
    );
  });

  it('fails closed when recorded evidence contradicts a trust claim', () => {
    const checks = evaluateTrust({
      ...validInput,
      fixtureManifestValid: false,
      provenance: { total: 3, complete: 2 },
      configurationApproved: false,
      shortlistApproved: false,
      abstentionCount: 0,
    });
    expect(checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'fixture_manifest_valid', status: 'FAIL' }),
        expect.objectContaining({ id: 'provenance_complete', status: 'FAIL' }),
        expect.objectContaining({ id: 'approval_gate', status: 'FAIL' }),
        expect.objectContaining({ id: 'abstention_visible', status: 'FAIL' }),
      ]),
    );
  });
});

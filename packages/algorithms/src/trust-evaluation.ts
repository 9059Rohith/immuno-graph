export type TrustCheckStatus = 'PASS' | 'FAIL' | 'UNAVAILABLE';

export interface TrustCheck {
  id:
    | 'fixture_manifest_valid'
    | 'provenance_complete'
    | 'constraints_enforced'
    | 'approval_gate'
    | 'artifact_hashes'
    | 'abstention_visible';
  label: string;
  status: TrustCheckStatus;
  detail: string;
  evidence: string[];
}

export interface TrustEvaluationInput {
  fixtureManifestValid: boolean | null;
  provenance: { total: number; complete: number };
  constraintOutcomeCount: number;
  configurationApproved: boolean;
  shortlistApproved: boolean;
  runFinished: boolean;
  artifactHashes: string[];
  abstentionCount: number;
}

export function evaluateTrust(input: TrustEvaluationInput): TrustCheck[] {
  const fixture: TrustCheck = {
    id: 'fixture_manifest_valid',
    label: 'Fixture manifest integrity',
    status:
      input.fixtureManifestValid === null
        ? 'UNAVAILABLE'
        : input.fixtureManifestValid
          ? 'PASS'
          : 'FAIL',
    detail:
      input.fixtureManifestValid === null
        ? 'No fixture manifest was available for independent verification.'
        : input.fixtureManifestValid
          ? 'The curated fixture registry loaded with frozen content hashes and approved metadata.'
          : 'The fixture manifest did not satisfy the approved synthetic-fixture contract.',
    evidence: [
      input.fixtureManifestValid === true
        ? 'Manifest and fixture content hashes verified at load time.'
        : 'Fixture verification did not produce a valid record.',
    ],
  };

  const provenance: TrustCheck = {
    id: 'provenance_complete',
    label: 'Connector provenance completeness',
    status:
      input.provenance.total === 0
        ? input.runFinished
          ? 'FAIL'
          : 'UNAVAILABLE'
        : input.provenance.complete === input.provenance.total
          ? 'PASS'
          : 'FAIL',
    detail:
      input.provenance.total === 0
        ? 'No connector executions have been recorded yet.'
        : `${input.provenance.complete} of ${input.provenance.total} connector executions include complete method, version, source, and hash evidence.`,
    evidence: [`Recorded connector executions: ${input.provenance.total}`],
  };

  const constraints: TrustCheck = {
    id: 'constraints_enforced',
    label: 'Biological constraints enforced',
    status: input.constraintOutcomeCount > 0 ? 'PASS' : input.runFinished ? 'FAIL' : 'UNAVAILABLE',
    detail:
      input.constraintOutcomeCount > 0
        ? `${input.constraintOutcomeCount} immutable rule outcomes were recorded before ranking.`
        : input.runFinished
          ? 'The completed analysis has no recorded constraint outcomes.'
          : 'Constraint outcomes become available after analysis.',
    evidence: [`Recorded rule outcomes: ${input.constraintOutcomeCount}`],
  };

  const approvals: TrustCheck = {
    id: 'approval_gate',
    label: 'Human approval gates',
    status:
      input.configurationApproved && input.shortlistApproved
        ? 'PASS'
        : input.runFinished
          ? 'FAIL'
          : 'UNAVAILABLE',
    detail:
      input.configurationApproved && input.shortlistApproved
        ? 'Configuration and shortlist snapshots were explicitly approved before reporting.'
        : input.runFinished
          ? 'One or more mandatory approval snapshots are not approved.'
          : 'Approval evidence is incomplete while the guided workflow is in progress.',
    evidence: [
      `Configuration approval: ${input.configurationApproved ? 'recorded' : 'not recorded'}`,
      `Shortlist approval: ${input.shortlistApproved ? 'recorded' : 'not recorded'}`,
    ],
  };

  const artifacts: TrustCheck = {
    id: 'artifact_hashes',
    label: 'Artifact hash verification',
    status: input.artifactHashes.length > 0 ? 'PASS' : 'UNAVAILABLE',
    detail:
      input.artifactHashes.length > 0
        ? `${input.artifactHashes.length} generated artifact${input.artifactHashes.length === 1 ? '' : 's'} carry immutable SHA-256 hashes.`
        : 'No report artifact has been generated yet; no hash claim is made.',
    evidence:
      input.artifactHashes.length > 0
        ? input.artifactHashes.map((hash) => `sha256:${hash}`)
        : ['Generate an approved report to create hash evidence.'],
  };

  const abstention: TrustCheck = {
    id: 'abstention_visible',
    label: 'Abstention and rejection visible',
    status: input.abstentionCount > 0 ? 'PASS' : input.runFinished ? 'FAIL' : 'UNAVAILABLE',
    detail:
      input.abstentionCount > 0
        ? `${input.abstentionCount} rule outcome${input.abstentionCount === 1 ? '' : 's'} explicitly abstain from or reject a candidate claim.`
        : input.runFinished
          ? 'No review or rejection outcome is visible in the completed analysis.'
          : 'Abstention evidence becomes available after constraints run.',
    evidence: [`Review or fail outcomes: ${input.abstentionCount}`],
  };

  return [fixture, provenance, constraints, approvals, artifacts, abstention];
}

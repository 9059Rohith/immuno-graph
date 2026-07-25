import type { RunConfiguration } from '@immunograph/shared';

export interface RunConfigurationDraft {
  mhciAlleles: string;
  mhciLengths: string;
  mhciiAlleles: string;
  mhciiLengths: string;
  populations: string;
  enableMhcflurry: boolean;
  enableBcell: boolean;
  fallbackPolicy: string;
  requestedExecutionMode?: 'AUTO' | 'LIVE' | 'SYNTHETIC' | 'FIXTURE';
  ruleProfileVersion: string;
  rankingProfileVersion: string;
}

const csv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const lengths = (value: string) => csv(value).map((item) => Number.parseInt(item, 10));

export function createRunConfigurationInput(draft: RunConfigurationDraft): RunConfiguration {
  return {
    analysis: {
      mhci: {
        enabled: true,
        alleles: csv(draft.mhciAlleles),
        peptideLengths: lengths(draft.mhciLengths),
        methods: ['iedb-recommended', ...(draft.enableMhcflurry ? ['mhcflurry-presentation'] : [])],
      },
      mhcii: {
        enabled: true,
        alleles: csv(draft.mhciiAlleles),
        peptideLengths: lengths(draft.mhciiLengths),
        methods: ['iedb-recommended'],
      },
      bcell: { enabled: draft.enableBcell, methods: draft.enableBcell ? ['graphbepi'] : [] },
    },
    populations: csv(draft.populations),
    fallbackPolicy: draft.fallbackPolicy,
    requestedExecutionMode: draft.requestedExecutionMode ?? 'AUTO',
    ruleProfileVersion: draft.ruleProfileVersion,
    rankingProfileVersion: draft.rankingProfileVersion,
    outputPreferences: {
      formats: ['JSON', 'CSV'],
      templateVersion: 'research-report-v1',
      includeWorkflowTrace: true,
      includeEvidenceGraph: true,
    },
  };
}

export function createShortlistApprovalInput(
  rankingSnapshotHash: string,
  candidateIds: string[],
  approvedCandidateIds: string[],
  note: string,
) {
  const approved = new Set(approvedCandidateIds);
  return {
    decision: 'APPROVE' as const,
    expectedRankingSnapshotHash: rankingSnapshotHash,
    approvedCandidateIds,
    excludedCandidateIds: candidateIds.filter((candidateId) => !approved.has(candidateId)),
    ...(note.trim() === '' ? {} : { note: note.trim() }),
  };
}

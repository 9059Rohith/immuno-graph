import type { RunDetailRecord } from '@immunograph/database';
import { runDetailSchema, type RunDetail, type SourceStatus } from '@immunograph/shared';

import { parseStoredRunConfiguration } from '../json.js';

const stageLabels: Record<string, string> = {
  validate_input: 'Validate input',
  configuration_approval: 'Configuration approval',
  generate_peptides: 'Generate peptides',
  predict_mhci: 'Predict MHC-I',
  predict_mhcii: 'Predict MHC-II',
  predict_bcell: 'Predict B-cell',
  join_evidence: 'Join evidence',
  normalize_scores: 'Normalize scores',
  compute_consensus: 'Compute consensus',
  calculate_candidate_coverage: 'Calculate population coverage',
  apply_base_constraints: 'Apply base constraints',
  preliminary_scoring: 'Preliminary scoring',
  resolve_overlaps: 'Resolve overlaps',
  apply_final_constraints: 'Apply final constraints',
  final_ranking: 'Final ranking',
  optimize_shortlist_coverage: 'Optimize shortlist coverage',
  shortlist_approval: 'Shortlist approval',
  generate_exports: 'Generate exports',
};
const retryableStages = new Set([
  'predict_mhci',
  'predict_mhcii',
  'predict_bcell',
  'calculate_candidate_coverage',
]);

export function mapRunDetail(record: RunDetailRecord, now: Date): RunDetail {
  const configuration = parseStoredRunConfiguration(record.configurationJson).request;
  const latestStages = new Map<string, (typeof record.stages)[number]>();
  for (const stage of record.stages) {
    const current = latestStages.get(stage.stageKey);
    if (current === undefined || stage.attempt > current.attempt)
      latestStages.set(stage.stageKey, stage);
  }
  const latestSnapshot = record.rankingResults.at(-1)?.snapshotHash;
  const counts = {
    MHCI: { recommended: 0, review: 0, rejected: 0 },
    MHCII: { recommended: 0, review: 0, rejected: 0 },
    BCELL: { recommended: 0, review: 0, rejected: 0 },
  };
  for (const ranking of record.rankingResults.filter(
    (item) => latestSnapshot === undefined || item.snapshotHash === latestSnapshot,
  )) {
    const target = counts[ranking.track as keyof typeof counts];
    if (target === undefined) continue;
    if (ranking.category === 'RECOMMENDED') target.recommended += 1;
    else if (ranking.category === 'REVIEW') target.review += 1;
    else if (ranking.category === 'REJECTED') target.rejected += 1;
  }
  const approvalRequirements =
    record.status === 'DRAFT' || record.status === 'AWAITING_CONFIGURATION_APPROVAL'
      ? ['CONFIGURATION']
      : record.status === 'AWAITING_SHORTLIST_APPROVAL'
        ? ['SHORTLIST']
        : [];
  return runDetailSchema.parse({
    id: record.id,
    projectId: record.projectId,
    revision: record.revision,
    status: record.status,
    quality: record.quality,
    executionMode: record.executionMode ?? null,
    configurationHash: record.configurationHash,
    configuration,
    candidateCounts: counts,
    stageProgress: [...latestStages.values()].map((stage) => {
      const execution = record.predictorExecutions.find((item) => item.stageId === stage.id);
      const end = stage.completedAt ?? (stage.status === 'RUNNING' ? now : null);
      return {
        stageKey: stage.stageKey,
        label: stageLabels[stage.stageKey] ?? stage.stageKey,
        status: stage.status === 'READY' ? 'PENDING' : stage.status,
        attempt: stage.attempt,
        progress: stage.progress ?? (stage.status === 'SUCCEEDED' ? 1 : 0),
        durationMs:
          stage.startedAt === null || end === null
            ? null
            : Math.max(0, end.getTime() - stage.startedAt.getTime()),
        sourceStatus: (execution?.sourceStatus as SourceStatus | undefined) ?? null,
        warningCode: null,
        errorCode: stage.errorCode,
        retryable: stage.status === 'FAILED' && retryableStages.has(stage.stageKey),
      };
    }),
    connectors: record.predictorExecutions.map((execution) => ({
      connectorId: execution.connectorId,
      method: execution.method,
      sourceStatus: execution.sourceStatus,
      version: execution.connectorVersion,
      durationMs: Math.max(
        0,
        (execution.completedAt ?? now).getTime() - execution.startedAt.getTime(),
      ),
      note: execution.errorCode,
    })),
    approvalRequirements,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString(),
  });
}

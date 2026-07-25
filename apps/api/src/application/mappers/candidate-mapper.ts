import type {
  CandidateComparisonRecord,
  CandidateDetailRecord,
  RankedCandidateRecord,
  ShortlistRecord,
} from '@immunograph/database';
import {
  candidateComparisonSchema,
  candidateDetailSchema,
  candidateListSchema,
  coverageSchema,
  type CandidateComparison,
  type CandidateDetail,
  type CandidateList,
  type SourceStatus,
} from '@immunograph/shared';
import type { PopulationCoverageResult } from '@prisma/client';

import { encodeCandidateCursor } from '../cursor.js';
import {
  coverageProvenanceSchema,
  evidenceDetailsSchema,
  rawScoresSchema,
  scoreMapSchema,
} from '../json.js';
import {
  shortlistOptimizationResponseSchema,
  type ShortlistOptimizationResponse,
} from '../response-schemas.js';

const sourceOrder: SourceStatus[] = ['LIVE', 'CACHED', 'SYNTHETIC', 'FIXTURE', 'FAILED'];

function unavailable(label: string) {
  return { value: null, unavailableReason: `${label} unavailable`, sourceStatus: null };
}

function confidence(value: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  return value >= 0.8 ? 'HIGH' : value >= 0.6 ? 'MEDIUM' : 'LOW';
}

function candidateCoverage(
  records: readonly PopulationCoverageResult[],
  candidateId: string,
): PopulationCoverageResult | null {
  return (
    records.find((record) => {
      if (record.purpose !== 'CANDIDATE_RANKING') return false;
      const ids: unknown = JSON.parse(record.candidateIdsJson);
      return Array.isArray(ids) && ids.length === 1 && ids[0] === candidateId;
    }) ?? null
  );
}

function measured(
  value: number | null | undefined,
  label: string,
  sourceStatus: SourceStatus | null,
) {
  return value === null || value === undefined
    ? unavailable(label)
    : { value, unavailableReason: null, sourceStatus };
}

function card(record: RankedCandidateRecord, coverageRecords: readonly PopulationCoverageResult[]) {
  const evidence = record.candidate.evidenceSummaries[0];
  const statuses = new Set(
    record.candidate.predictionObservations.map(
      (observation) => observation.predictorExecution.sourceStatus as SourceStatus,
    ),
  );
  const sourceMix = sourceOrder.filter((status) => statuses.has(status));
  const primarySource = sourceMix[0] ?? null;
  const singleton = candidateCoverage(coverageRecords, record.candidateId);
  const coverageProvenance =
    singleton === null
      ? null
      : coverageProvenanceSchema.parse(JSON.parse(singleton.provenanceJson));
  const details =
    evidence === undefined
      ? { topReasons: [] as string[] }
      : evidenceDetailsSchema.parse(JSON.parse(evidence.detailsJson));
  const warnings = record.candidate.constraintOutcomes
    .filter((outcome) => outcome.outcome === 'REVIEW' || outcome.outcome === 'FAIL')
    .map((outcome) => outcome.message);
  const passingReasons = record.candidate.constraintOutcomes
    .filter((outcome) => outcome.outcome === 'PASS')
    .map((outcome) => outcome.message);
  return {
    id: record.candidate.id,
    track: record.track,
    rank: record.rank,
    peptide: record.candidate.peptide,
    start: record.candidate.start,
    end: record.candidate.end,
    allele: record.candidate.allele,
    predictorScore: measured(evidence?.bindingQuality, 'Binding score', primarySource),
    agreement: measured(evidence?.agreement, 'Agreement', primarySource),
    completeness: measured(evidence?.completeness, 'Completeness', primarySource),
    singletonCoverage: measured(
      singleton?.projectedCoverage,
      'Population coverage',
      coverageProvenance?.sourceStatus ?? null,
    ),
    finalScore: record.finalScore,
    confidence: confidence(record.confidence),
    category: record.category,
    topReasons: [...details.topReasons, ...passingReasons].slice(0, 3),
    warnings,
    sourceMix,
    selectable: record.category !== 'REJECTED',
  };
}

export function mapCandidatePage(
  records: readonly RankedCandidateRecord[],
  coverageRecords: readonly PopulationCoverageResult[],
  rankingSnapshotHash: string,
  nextCursor: { rank: number; finalScore: number; start: number; id: string } | null,
): CandidateList {
  return candidateListSchema.parse({
    items: records.map((record) => card(record, coverageRecords)),
    nextCursor: nextCursor === null ? null : encodeCandidateCursor(nextCursor),
    rankingSnapshotHash,
  });
}

export function mapCoverage(
  request: { populationId: string; purpose: string; candidateId: string | null },
  record: PopulationCoverageResult | null,
) {
  const provenance =
    record === null ? null : coverageProvenanceSchema.parse(JSON.parse(record.provenanceJson));
  return coverageSchema.parse({
    populationId: request.populationId,
    purpose: request.purpose,
    candidateId: request.candidateId,
    coverage: measured(
      record?.projectedCoverage,
      'Population coverage',
      provenance?.sourceStatus ?? null,
    ),
    method: provenance?.method ?? null,
    observedAt: record?.createdAt.toISOString() ?? null,
  });
}

export function mapCandidateDetail(
  detail: CandidateDetailRecord,
  coverageRecords: readonly PopulationCoverageResult[],
  graphNeighborIds: readonly string[],
  deterministicExplanation: string,
): CandidateDetail {
  const syntheticPageRecord = {
    ...detail.ranking,
    candidate: detail.candidate,
  } as RankedCandidateRecord;
  const singleton = candidateCoverage(coverageRecords, detail.candidate.id);
  const shortlist = coverageRecords.find((record) => record.purpose === 'FINAL_SHORTLIST') ?? null;
  const evidence = detail.candidate.evidenceSummaries[0];
  const components = scoreMapSchema.parse(JSON.parse(detail.ranking.componentScoresJson));
  const penalties = scoreMapSchema.parse(JSON.parse(detail.ranking.penaltiesJson));
  const normalized = new Map(
    detail.candidate.normalizedObservations.map((observation) => [
      observation.predictionObservationId,
      observation,
    ]),
  );
  return candidateDetailSchema.parse({
    candidate: card(syntheticPageRecord, coverageRecords),
    observations: detail.candidate.predictionObservations.map((observation) => {
      const raw = rawScoresSchema.parse(JSON.parse(observation.rawScoresJson));
      const transformed = normalized.get(observation.id);
      return {
        method: observation.predictorExecution.method,
        version: observation.predictorExecution.methodVersion,
        sourceStatus: observation.predictorExecution.sourceStatus,
        rawValue: raw.value,
        normalizedValue: transformed?.normalizedValue ?? null,
        transformation: transformed?.transformationJson ?? null,
      };
    }),
    consensus: measured(evidence?.consensus, 'Consensus', null),
    completeness: measured(evidence?.completeness, 'Completeness', null),
    singletonCoverage: measured(singleton?.projectedCoverage, 'Population coverage', null),
    shortlistCoverage: measured(shortlist?.projectedCoverage, 'Shortlist coverage', null),
    constraints: detail.candidate.constraintOutcomes.map((outcome) => ({
      ruleId: outcome.ruleId,
      label: outcome.ruleId,
      outcome: outcome.outcome,
      reason: outcome.message,
    })),
    ranking: {
      components: Object.entries(components).map(([name, value]) => ({
        name,
        value,
        effectiveWeight: 1,
      })),
      penalties: Object.entries(penalties).map(([name, value]) => ({ name, value })),
      finalScore: detail.ranking.finalScore,
    },
    graphNeighborIds: [...graphNeighborIds],
    deterministicExplanation,
    llmExplanation: null,
  });
}

export function mapCandidateComparison(
  records: readonly CandidateComparisonRecord[],
): CandidateComparison {
  const componentNames = new Set<string>();
  const ruleIds = new Set<string>();
  const componentsByCandidate = new Map<string, Record<string, number>>();
  for (const record of records) {
    const components = scoreMapSchema.parse(JSON.parse(record.ranking.componentScoresJson));
    componentsByCandidate.set(record.candidate.id, components);
    Object.keys(components).forEach((name) => componentNames.add(name));
    record.constraints.forEach(({ ruleId }) => ruleIds.add(ruleId));
  }
  return candidateComparisonSchema.parse({
    track: records[0]?.ranking.track,
    candidates: records.map(({ candidate, ranking }) => ({
      id: candidate.id,
      peptide: candidate.peptide,
      rank: ranking.rank,
      finalScore: ranking.finalScore,
      confidence: confidence(ranking.confidence),
      category: ranking.category,
    })),
    components: [...componentNames].sort().map((name) => ({
      name,
      values: Object.fromEntries(
        records.map(({ candidate }) => [
          candidate.id,
          componentsByCandidate.get(candidate.id)?.[name] ?? null,
        ]),
      ),
    })),
    constraints: [...ruleIds].sort().map((ruleId) => ({
      ruleId,
      label: ruleId,
      outcomes: Object.fromEntries(
        records.map(({ candidate, constraints }) => [
          candidate.id,
          constraints.find((outcome) => outcome.ruleId === ruleId)?.outcome ?? 'REVIEW',
        ]),
      ),
    })),
  });
}

export function mapShortlistOptimization(record: ShortlistRecord): ShortlistOptimizationResponse {
  return shortlistOptimizationResponseSchema.parse({
    rankingSnapshotHash: record.snapshotHash,
    track: record.track,
    algorithmId: record.algorithmId,
    algorithmVersion: record.algorithmVersion,
    steps: record.selectionSteps.map((step) => ({
      step: step.step,
      candidateId: step.selectedCandidateId,
      marginalCoverageGain: step.marginalCoverageGain,
      cumulativeCoverage: step.cumulativeCoverage,
      reasonCode: step.reasonCode,
    })),
    finalCoverage: record.finalCoverageResult.projectedCoverage,
  });
}

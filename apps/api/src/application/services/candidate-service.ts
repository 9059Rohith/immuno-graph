import { explainCandidate } from '@immunograph/algorithms';
import type { Repositories } from '@immunograph/database';

import { decodeCandidateCursor } from '../cursor.js';
import { ApplicationError, resourceNotFound } from '../errors.js';
import { scoreMapSchema } from '../json.js';
import {
  mapCandidateComparison,
  mapCandidateDetail,
  mapCandidatePage,
  mapCoverage,
  mapShortlistOptimization,
} from '../mappers/candidate-mapper.js';

type CandidateRepositories = Pick<
  Repositories,
  | 'runs'
  | 'rankingResults'
  | 'candidates'
  | 'populationCoverageResults'
  | 'shortlistOptimizationResults'
  | 'graphNodes'
>;

export class CandidateService {
  constructor(private readonly repositories: CandidateRepositories) {}

  async list(input: {
    runId: string;
    track?: 'MHCI' | 'MHCII' | 'BCELL';
    category?: 'RECOMMENDED' | 'REVIEW' | 'REJECTED';
    sourceStatus?: 'LIVE' | 'CACHED' | 'SYNTHETIC' | 'FIXTURE' | 'FAILED';
    allele?: string;
    minScore?: number;
    maxScore?: number;
    search?: string;
    hasWarnings?: boolean;
    sort: 'rank' | 'score' | 'start';
    limit: number;
    cursor?: string;
  }) {
    await this.requireRun(input.runId);
    const rankingSnapshotHash = await this.repositories.rankingResults.findLatestSnapshotHash(
      input.runId,
    );
    if (rankingSnapshotHash === null) throw resourceNotFound('ranking snapshot');
    const [page, coverage] = await Promise.all([
      this.repositories.candidates.listRanked({
        runId: input.runId,
        rankingSnapshotHash,
        sort: input.sort,
        limit: input.limit,
        ...(input.track === undefined ? {} : { track: input.track }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.sourceStatus === undefined ? {} : { sourceStatus: input.sourceStatus }),
        ...(input.allele === undefined ? {} : { allele: input.allele }),
        ...(input.minScore === undefined ? {} : { minScore: input.minScore }),
        ...(input.maxScore === undefined ? {} : { maxScore: input.maxScore }),
        ...(input.search === undefined ? {} : { search: input.search }),
        ...(input.hasWarnings === undefined ? {} : { hasWarnings: input.hasWarnings }),
        ...(input.cursor === undefined ? {} : { after: decodeCandidateCursor(input.cursor) }),
      }),
      this.repositories.populationCoverageResults.listByRun(input.runId),
    ]);
    return mapCandidatePage(page.items, coverage, rankingSnapshotHash, page.nextCursor);
  }

  async get(input: { runId: string; candidateId: string }) {
    await this.requireRun(input.runId);
    const snapshotHash = await this.repositories.rankingResults.findLatestSnapshotHash(input.runId);
    if (snapshotHash === null) throw resourceNotFound('ranking snapshot');
    const [detail, coverage, neighborhood] = await Promise.all([
      this.repositories.candidates.findDetail(input.runId, input.candidateId, snapshotHash),
      this.repositories.populationCoverageResults.listByRun(input.runId),
      this.repositories.graphNodes.findNeighborhood({
        runId: input.runId,
        candidateId: input.candidateId,
        depth: 1,
      }),
    ]);
    if (detail === null) throw resourceNotFound('candidate');
    const explanation = explainCandidate({
      audience: 'RESEARCHER',
      candidateKey: detail.candidate.candidateKey,
      category: detail.ranking.category as 'RECOMMENDED' | 'REVIEW' | 'REJECTED',
      trackRank: detail.ranking.rank,
      finalScore: detail.ranking.finalScore,
      componentScores: scoreMapSchema.parse(JSON.parse(detail.ranking.componentScoresJson)),
      ruleOutcomes: detail.candidate.constraintOutcomes.map((outcome) => ({
        ruleId: outcome.ruleId,
        outcome:
          outcome.outcome === 'REVIEW' ? ('WARN' as const) : (outcome.outcome as 'PASS' | 'FAIL'),
      })),
      provenanceStatuses: detail.candidate.predictionObservations.map(
        (observation) =>
          observation.predictorExecution.sourceStatus as 'LIVE' | 'CACHED' | 'FIXTURE' | 'FAILED',
      ),
    });
    const neighborIds = neighborhood.nodes
      .map((node) => node.entityId)
      .filter((id) => id !== input.candidateId);
    return mapCandidateDetail(detail, coverage, neighborIds, explanation.text);
  }

  async compare(input: { runId: string; candidateIds: string[] }) {
    await this.requireRun(input.runId);
    const snapshotHash = await this.repositories.rankingResults.findLatestSnapshotHash(input.runId);
    if (snapshotHash === null) throw resourceNotFound('ranking snapshot');
    const records = await this.repositories.candidates.findComparison(
      input.runId,
      input.candidateIds,
      snapshotHash,
    );
    if (records.length !== input.candidateIds.length) throw resourceNotFound('candidate');
    if (new Set(records.map((record) => record.ranking.track)).size !== 1) {
      throw new ApplicationError(
        'CANDIDATE_TRACK_MISMATCH',
        422,
        'Compared candidates must share one track.',
      );
    }
    return mapCandidateComparison(records);
  }

  async coverage(input: {
    runId: string;
    populationId: string;
    purpose: 'CANDIDATE_RANKING' | 'SHORTLIST_OPTIMIZATION' | 'FINAL_SHORTLIST';
    candidateId?: string;
  }) {
    await this.requireRun(input.runId);
    const record = await this.repositories.populationCoverageResults.findMatch(input);
    return mapCoverage(
      {
        populationId: input.populationId,
        purpose: input.purpose,
        candidateId: input.candidateId ?? null,
      },
      record,
    );
  }

  async shortlistOptimization(input: { runId: string; track: 'MHCI' | 'MHCII' }) {
    await this.requireRun(input.runId);
    if ((input.track as string) === 'BCELL') {
      throw new ApplicationError(
        'INVALID_COVERAGE_TRACK',
        422,
        'Shortlist coverage optimization supports MHC-I and MHC-II only.',
      );
    }
    const record = await this.repositories.shortlistOptimizationResults.findLatest(
      input.runId,
      input.track,
    );
    return record === null ? null : mapShortlistOptimization(record);
  }

  private async requireRun(runId: string): Promise<void> {
    if ((await this.repositories.runs.findById(runId)) === null) throw resourceNotFound('run');
  }
}

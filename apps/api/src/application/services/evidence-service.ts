import type { Repositories } from '@immunograph/database';

import { resourceNotFound } from '../errors.js';
import {
  mapConnectorStatus,
  mapConstraintSummary,
  mapCoverageVisualization,
  mapEvidenceGraph,
  mapRelationalEvidenceGraph,
  mapScoreDistribution,
  mapSequenceMap,
  mapWorkflowGraph,
} from '../mappers/graph-mapper.js';

type EvidenceRepositories = Pick<
  Repositories,
  | 'runs'
  | 'graphNodes'
  | 'candidates'
  | 'proteins'
  | 'rankingResults'
  | 'populationCoverageResults'
  | 'constraintOutcomes'
  | 'predictorExecutions'
>;

type VisualizationType =
  | 'sequence-map'
  | 'population-coverage'
  | 'constraint-summary'
  | 'score-distribution'
  | 'connector-status';

export class EvidenceService {
  constructor(
    private readonly repositories: EvidenceRepositories,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async evidence(input: { runId: string; candidateId?: string; depth: number }) {
    const run = await this.requireRun(input.runId);
    if (input.candidateId !== undefined) {
      const candidate = await this.repositories.candidates.findById(input.candidateId);
      if (candidate === null || candidate.runId !== input.runId)
        throw resourceNotFound('candidate');
    }
    const record = await this.repositories.graphNodes.findNeighborhood(input);
    const generatedAt = this.clock();
    if (record.nodes.length > 0) return mapEvidenceGraph(record, generatedAt);
    const [protein, candidates, rankings] = await Promise.all([
      this.repositories.proteins.findCurrentByProject(run.projectId),
      this.repositories.candidates.listByRun(input.runId),
      this.repositories.rankingResults.listByRun(input.runId),
    ]);
    if (protein === null) throw resourceNotFound('protein');
    return mapRelationalEvidenceGraph(
      {
        protein,
        candidates,
        rankings,
        ...(input.candidateId === undefined ? {} : { candidateId: input.candidateId }),
      },
      generatedAt,
    );
  }

  async workflow(runId: string) {
    const record = await this.repositories.runs.findDetailById(runId);
    if (record === null) throw resourceNotFound('run');
    return mapWorkflowGraph(record, this.clock());
  }

  async visualization(input: { runId: string; type: VisualizationType }) {
    const run = await this.repositories.runs.findById(input.runId);
    if (run === null) throw resourceNotFound('run');
    const now = this.clock();
    switch (input.type) {
      case 'sequence-map': {
        const [protein, snapshotHash] = await Promise.all([
          this.repositories.proteins.findCurrentByProject(run.projectId),
          this.repositories.rankingResults.findLatestSnapshotHash(input.runId),
        ]);
        if (protein === null) throw resourceNotFound('protein');
        if (snapshotHash === null) return mapSequenceMap(protein.sequenceLength, [], now);
        const page = await this.repositories.candidates.listRanked({
          runId: input.runId,
          rankingSnapshotHash: snapshotHash,
          sort: 'start',
          limit: 500,
        });
        return mapSequenceMap(
          protein.sequenceLength,
          page.items.map((ranking) => ({
            id: ranking.candidate.id,
            candidateType: ranking.candidate.candidateType,
            start: ranking.candidate.start,
            end: ranking.candidate.end,
            peptide: ranking.candidate.peptide,
            category: ranking.category,
          })),
          now,
        );
      }
      case 'population-coverage':
        return mapCoverageVisualization(
          await this.repositories.populationCoverageResults.listByRun(input.runId),
          now,
        );
      case 'constraint-summary':
        return mapConstraintSummary(
          await this.repositories.constraintOutcomes.listByRun(input.runId),
          now,
        );
      case 'score-distribution':
        return mapScoreDistribution(
          await this.repositories.rankingResults.listByRun(input.runId),
          now,
        );
      case 'connector-status':
        return mapConnectorStatus(
          await this.repositories.predictorExecutions.listByRun(input.runId),
          now,
        );
    }
  }

  private async requireRun(runId: string) {
    const run = await this.repositories.runs.findById(runId);
    if (run === null) throw resourceNotFound('run');
    return run;
  }
}

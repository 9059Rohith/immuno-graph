import { explainCandidate } from '@immunograph/algorithms';
import type { Repositories } from '@immunograph/database';
import type { RunConfiguration } from '@immunograph/shared';

import type { ApiServiceContext } from '../../services.js';
import type { ArtifactStore } from '../artifact-store.js';
import { ApplicationError, artifactNotFound, resourceNotFound } from '../errors.js';
import { parseStoredRunConfiguration, scoreMapSchema } from '../json.js';
import { mapArtifactList, mapReportJob } from '../mappers/report-mapper.js';
import type { ReportGenerationPort } from '../ports.js';
import { explanationResponseSchema } from '../response-schemas.js';

type ReportRepositories = Pick<
  Repositories,
  'runs' | 'candidates' | 'rankingResults' | 'approvals' | 'artifacts'
>;

type OutputPreferences = RunConfiguration['outputPreferences'];

export class ReportService {
  constructor(
    private readonly repositories: ReportRepositories,
    private readonly reportPort: ReportGenerationPort,
    private readonly artifactStore: ArtifactStore,
  ) {}

  async explanation(input: {
    runId: string;
    candidateId: string;
    mode: 'DETERMINISTIC' | 'LLM';
    audience: 'RESEARCHER' | 'JUDGE';
  }) {
    await this.requireRun(input.runId);
    const snapshotHash = await this.repositories.rankingResults.findLatestSnapshotHash(input.runId);
    if (snapshotHash === null) throw resourceNotFound('ranking snapshot');
    const detail = await this.repositories.candidates.findDetail(
      input.runId,
      input.candidateId,
      snapshotHash,
    );
    if (detail === null) throw resourceNotFound('candidate');
    const explanation = explainCandidate({
      audience: input.audience,
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
        ({ predictorExecution }) =>
          predictorExecution.sourceStatus as 'LIVE' | 'CACHED' | 'SYNTHETIC' | 'FIXTURE' | 'FAILED',
      ),
    });
    return explanationResponseSchema.parse({
      text: explanation.text,
      generationModeUsed: 'DETERMINISTIC',
    });
  }

  async createReport(input: { runId: string } & OutputPreferences, context: ApiServiceContext) {
    const run = await this.requireRun(input.runId);
    const approval = await this.repositories.approvals.findLatest(input.runId, 'SHORTLIST');
    if (approval === null || approval.status !== 'APPROVED') {
      throw new ApplicationError(
        'REPORT_REQUIRES_APPROVAL',
        422,
        'Report generation requires an approved shortlist.',
      );
    }
    const rankings = await this.repositories.rankingResults.findSnapshot(
      input.runId,
      approval.snapshotHash,
    );
    if (rankings.length === 0) {
      throw new ApplicationError(
        'RANKING_CHANGED',
        409,
        'The approved ranking snapshot is unavailable.',
      );
    }
    const expected = parseStoredRunConfiguration(run.configurationJson).request.outputPreferences;
    const supplied: OutputPreferences = {
      formats: [...input.formats].sort(),
      templateVersion: input.templateVersion,
      includeWorkflowTrace: input.includeWorkflowTrace,
      includeEvidenceGraph: input.includeEvidenceGraph,
    };
    const normalizedExpected: OutputPreferences = {
      ...expected,
      formats: [...expected.formats].sort(),
    };
    if (JSON.stringify(supplied) !== JSON.stringify(normalizedExpected)) {
      throw new ApplicationError(
        'REPORT_OPTIONS_MISMATCH',
        422,
        'Report options must match the immutable run configuration.',
      );
    }
    await this.reportPort.assertAvailable();
    return mapReportJob(
      await this.reportPort.generate({
        runId: input.runId,
        requestId: context.requestId,
        options: expected,
      }),
    );
  }

  async listArtifacts(runId: string) {
    await this.requireRun(runId);
    return mapArtifactList(await this.repositories.artifacts.listByRun(runId));
  }

  async downloadArtifact(artifactId: string) {
    const artifact = await this.repositories.artifacts.findById(artifactId);
    if (artifact === null) throw artifactNotFound();
    return this.artifactStore.open(artifact);
  }

  private async requireRun(runId: string) {
    const run = await this.repositories.runs.findById(runId);
    if (run === null) throw resourceNotFound('run');
    return run;
  }
}

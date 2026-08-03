import { evaluateTrust } from '@immunograph/algorithms';
import {
  fixtureManifestSummary,
  loadFixtureRegistry,
  type Repositories,
} from '@immunograph/database';
import { trustSummarySchema, type SourceStatus, type TrustSummary } from '@immunograph/shared';

import { resourceNotFound } from '../errors.js';

type TrustRepositories = Pick<Repositories, 'runs' | 'constraintOutcomes' | 'artifacts'>;
type ManifestSummary = ReturnType<typeof fixtureManifestSummary>;
type ManifestProvider = () => Promise<ManifestSummary>;

const sourceStatuses: SourceStatus[] = ['LIVE', 'CACHED', 'SYNTHETIC', 'FIXTURE', 'FAILED'];
const defaultManifestProvider: ManifestProvider = async () =>
  fixtureManifestSummary(await loadFixtureRegistry());

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export class TrustService {
  constructor(
    private readonly repositories: TrustRepositories,
    private readonly manifestProvider: ManifestProvider = defaultManifestProvider,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async get(runId: string): Promise<TrustSummary> {
    const run = await this.repositories.runs.findDetailById(runId);
    if (run === null) throw resourceNotFound('run');

    const [constraints, artifacts, manifest] = await Promise.all([
      this.repositories.constraintOutcomes.listByRun(runId),
      this.repositories.artifacts.listByRun(runId),
      this.manifestProvider().catch(() => null),
    ]);
    const fixtureEntry = manifest?.entries.find(({ fixtureId }) => fixtureId === 'dengue') ?? null;
    const fixtureManifestValid =
      manifest !== null &&
      fixtureEntry !== null &&
      fixtureEntry.reviewStatus === 'APPROVED' &&
      fixtureEntry.sourceKind === 'SYNTHETIC' &&
      fixtureEntry.scientificUse === false;
    const completeProvenance = run.predictorExecutions.filter(
      (execution) =>
        hasText(execution.connectorId) &&
        hasText(execution.connectorVersion) &&
        hasText(execution.method) &&
        hasText(execution.methodVersion) &&
        hasText(execution.inputHash) &&
        (hasText(execution.outputHash) || execution.status === 'FAILED'),
    ).length;
    const configurationApproved = run.approvals.some(
      (approval) => approval.type === 'CONFIGURATION' && approval.status === 'APPROVED',
    );
    const shortlistApproved = run.approvals.some(
      (approval) => approval.type === 'SHORTLIST' && approval.status === 'APPROVED',
    );
    const analysisFinished = ['AWAITING_SHORTLIST_APPROVAL', 'COMPLETED'].includes(run.status);
    const checks = evaluateTrust({
      fixtureManifestValid: manifest === null ? null : fixtureManifestValid,
      provenance: { total: run.predictorExecutions.length, complete: completeProvenance },
      constraintOutcomeCount: constraints.length,
      configurationApproved,
      shortlistApproved,
      runFinished: analysisFinished,
      artifactHashes: artifacts.map(({ sha256 }) => sha256),
      abstentionCount: constraints.filter(({ outcome }) => outcome === 'FAIL' || outcome === 'REVIEW')
        .length,
    });

    return trustSummarySchema.parse({
      run: {
        id: run.id,
        revision: run.revision,
        status: run.status,
        quality: run.quality,
        requestedExecutionMode: run.requestedExecutionMode,
        executionMode: run.executionMode,
        configurationHash: run.configurationHash,
      },
      fixtureManifest:
        manifest === null || fixtureEntry === null || !fixtureManifestValid
          ? null
          : {
              version: manifest.version,
              sha256: manifest.sha256,
              fixtureId: fixtureEntry.fixtureId,
              entrySha256: fixtureEntry.sha256,
              reviewStatus: fixtureEntry.reviewStatus,
              sourceKind: fixtureEntry.sourceKind,
              scientificUse: fixtureEntry.scientificUse,
            },
      sourceCounts: sourceStatuses.map((status) => ({
        status,
        count: run.predictorExecutions.filter((execution) => execution.sourceStatus === status)
          .length,
      })),
      stages: run.stages.map((stage) => ({
        stageKey: stage.stageKey,
        attempt: stage.attempt,
        status: stage.status,
        inputHash: stage.inputHash,
        outputHash: stage.outputHash,
      })),
      approvals: run.approvals.map((approval) => ({
        id: approval.id,
        type: approval.type,
        status: approval.status,
        snapshotHash: approval.snapshotHash,
        recordedAt: approval.createdAt.toISOString(),
      })),
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        type: artifact.type,
        format: artifact.format,
        byteSize: artifact.byteSize,
        sha256: artifact.sha256,
        createdAt: artifact.createdAt.toISOString(),
      })),
      checks,
      disclaimer: 'Demonstration only — not scientific output.',
      evaluatedAt: this.clock().toISOString(),
    });
  }
}

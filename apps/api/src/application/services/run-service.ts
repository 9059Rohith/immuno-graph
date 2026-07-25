import { canonicalJson, type CanonicalJsonValue } from '@immunograph/algorithms';
import {
  DEFAULT_PROFILE_DIRECTORY,
  loadProfileVersion,
  loadReferenceBundle,
  type Repositories,
  type TransactionManager,
} from '@immunograph/database';
import { runConfigurationSchema, type RunConfiguration } from '@immunograph/shared';

import type { ApiServiceContext } from '../../services.js';
import { ApplicationError, resourceNotFound } from '../errors.js';
import {
  configurationHash,
  normalizeRunConfiguration,
  serializeRunConfiguration,
  type StoredRunConfiguration,
} from '../json.js';
import { mapRunDetail } from '../mappers/run-mapper.js';
import type { WorkflowExecutionPort } from '../ports.js';
import { ReferenceDataService } from '../reference-data-service.js';
import type { EventService } from './event-service.js';

type RunRepositories = Pick<
  Repositories,
  | 'projects'
  | 'proteins'
  | 'runs'
  | 'approvals'
  | 'events'
  | 'stages'
  | 'rankingResults'
  | 'candidates'
>;

export class RunService {
  constructor(
    private readonly repositories: RunRepositories,
    private readonly transactions: TransactionManager,
    private readonly eventService: EventService,
    private readonly workflowPort: WorkflowExecutionPort,
    private readonly profileDirectory: string = DEFAULT_PROFILE_DIRECTORY,
    private readonly clock: () => Date = () => new Date(),
    private readonly referenceData: ReferenceDataService = new ReferenceDataService(
      loadReferenceBundle(),
    ),
  ) {}

  async create(input: { projectId: string } & RunConfiguration) {
    const [project, protein] = await Promise.all([
      this.repositories.projects.findById(input.projectId),
      this.repositories.proteins.findCurrentByProject(input.projectId),
    ]);
    if (project === null || protein === null) throw resourceNotFound('project');
    const parsed = runConfigurationSchema.parse(stripProjectId(input));
    const [mhci, mhcii] = await Promise.all([
      parsed.analysis.mhci.enabled
        ? this.referenceData.validateTrack({
            candidateType: 'MHCI',
            alleles: parsed.analysis.mhci.alleles,
            methods: parsed.analysis.mhci.methods,
            peptideLengths: parsed.analysis.mhci.peptideLengths,
          })
        : parsed.analysis.mhci,
      parsed.analysis.mhcii.enabled
        ? this.referenceData.validateTrack({
            candidateType: 'MHCII',
            alleles: parsed.analysis.mhcii.alleles,
            methods: parsed.analysis.mhcii.methods,
            peptideLengths: parsed.analysis.mhcii.peptideLengths,
          })
        : parsed.analysis.mhcii,
    ]);
    const request = normalizeRunConfiguration({
      ...parsed,
      analysis: {
        ...parsed.analysis,
        mhci: { ...parsed.analysis.mhci, ...mhci },
        mhcii: { ...parsed.analysis.mhcii, ...mhcii },
      },
    });
    let biologicalConstraints;
    let ranking;
    try {
      [biologicalConstraints, ranking] = await Promise.all([
        loadProfileVersion(
          'biologicalConstraints',
          request.ruleProfileVersion,
          this.profileDirectory,
        ),
        loadProfileVersion('ranking', request.rankingProfileVersion, this.profileDirectory),
      ]);
    } catch {
      throw new ApplicationError(
        'PROFILE_NOT_FOUND',
        422,
        'The selected immutable profile version is not available.',
      );
    }
    const snapshot: StoredRunConfiguration = {
      request,
      profiles: {
        biologicalConstraints: biologicalConstraints.metadata,
        ranking: ranking.metadata,
      },
    };
    const hash = configurationHash(snapshot);
    const created = await this.transactions.run(async (repositories) => {
      const revision = await repositories.runs.nextRevision(input.projectId);
      return repositories.runs.create({
        projectId: input.projectId,
        proteinInputId: protein.id,
        revision,
        status: 'DRAFT',
        configurationJson: serializeRunConfiguration(snapshot),
        configurationHash: hash,
        ruleProfileVersion: request.ruleProfileVersion,
        rankingProfileVersion: request.rankingProfileVersion,
        requestedExecutionMode: request.requestedExecutionMode,
      });
    });
    return this.get(created.id);
  }

  async get(runId: string) {
    const record = await this.repositories.runs.findDetailById(runId);
    if (record === null) throw resourceNotFound('run');
    return mapRunDetail(record, this.clock());
  }

  async approveConfiguration(input: {
    runId: string;
    decision: 'APPROVE';
    expectedConfigurationHash: string;
    note?: string;
  }) {
    const run = await this.requireRun(input.runId);
    if (run.configurationHash !== input.expectedConfigurationHash) {
      throw new ApplicationError(
        'CONFIGURATION_CHANGED',
        409,
        'The run configuration has changed.',
      );
    }
    if (!['DRAFT', 'AWAITING_CONFIGURATION_APPROVAL'].includes(run.status)) {
      throw new ApplicationError(
        'RUN_ALREADY_APPROVED',
        409,
        'The run configuration is already approved.',
      );
    }
    const at = this.clock();
    const event = await this.transactions.run(async (repositories) => {
      await repositories.approvals.create({
        runId: input.runId,
        type: 'CONFIGURATION',
        status: 'APPROVED',
        snapshotHash: run.configurationHash,
        selectionJson: '{}',
        ...(input.note === undefined ? {} : { note: input.note }),
        createdAt: at,
      });
      const transitioned = await repositories.runs.transitionControl(
        input.runId,
        ['DRAFT', 'AWAITING_CONFIGURATION_APPROVAL'],
        { status: 'QUEUED' },
      );
      if (transitioned === null) {
        throw new ApplicationError(
          'CONFIGURATION_CHANGED',
          409,
          'The run configuration state changed.',
        );
      }
      return this.eventService.append(repositories, {
        runId: input.runId,
        eventType: 'run.status_changed',
        level: 'INFO',
        message: 'Run queued after configuration approval.',
        data: { runId: input.runId, status: 'QUEUED', at: at.toISOString() },
      });
    });
    this.eventService.publish(event);
    return this.get(input.runId);
  }

  async start(input: { runId: string }, context: ApiServiceContext) {
    const run = await this.requireRun(input.runId);
    if (run.status === 'RUNNING' || run.startedAt !== null) {
      throw new ApplicationError('RUN_ALREADY_STARTED', 409, 'The run has already started.');
    }
    if (run.status !== 'QUEUED') {
      throw new ApplicationError('RUN_NOT_APPROVED', 409, 'The run is not approved and queued.');
    }
    await this.workflowPort.assertAvailable();
    const at = this.clock();
    const event = await this.transactions.run(async (repositories) => {
      const transitioned = await repositories.runs.transitionControl(input.runId, ['QUEUED'], {
        status: 'RUNNING',
        startedAt: at,
      });
      if (transitioned === null) {
        throw new ApplicationError(
          'RUN_ALREADY_STARTED',
          409,
          'The run state changed before start.',
        );
      }
      return this.eventService.append(repositories, {
        runId: input.runId,
        eventType: 'run.status_changed',
        level: 'INFO',
        message: 'Run started.',
        data: { runId: input.runId, status: 'RUNNING', at: at.toISOString() },
      });
    });
    this.eventService.publish(event);
    try {
      await this.workflowPort.start({ runId: input.runId, requestId: context.requestId });
    } catch (error) {
      await this.transactions.run((repositories) =>
        repositories.runs.transitionControl(input.runId, ['RUNNING'], {
          status: 'FAILED',
          failureCode: 'WORKFLOW_EXECUTION_FAILED',
          completedAt: this.clock(),
        }),
      );
      throw error;
    }
    return this.get(input.runId);
  }

  async cancel(input: { runId: string }, context: ApiServiceContext) {
    const run = await this.requireRun(input.runId);
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      throw new ApplicationError('RUN_ALREADY_TERMINAL', 409, 'The run is already terminal.');
    }
    await this.workflowPort.assertAvailable();
    await this.workflowPort.cancel({ runId: input.runId, requestId: context.requestId });
    const at = this.clock();
    const event = await this.transactions.run(async (repositories) => {
      const transitioned = await repositories.runs.transitionControl(input.runId, [run.status], {
        status: 'CANCELLED',
        completedAt: at,
      });
      if (transitioned === null) {
        throw new ApplicationError(
          'RUN_ALREADY_TERMINAL',
          409,
          'The run state changed before cancellation.',
        );
      }
      return this.eventService.append(repositories, {
        runId: input.runId,
        eventType: 'run.status_changed',
        level: 'INFO',
        message: 'Run cancelled.',
        data: { runId: input.runId, status: 'CANCELLED', at: at.toISOString() },
      });
    });
    this.eventService.publish(event);
    return this.get(input.runId);
  }

  async retryStage(
    input: { runId: string; stageKey: string; expectedAttempt: number },
    context: ApiServiceContext,
  ) {
    await this.requireRun(input.runId);
    const stage = await this.repositories.stages.findLatestByKey(input.runId, input.stageKey);
    const retryable = new Set([
      'predict_mhci',
      'predict_mhcii',
      'predict_bcell',
      'calculate_candidate_coverage',
    ]);
    if (
      stage === null ||
      stage.status !== 'FAILED' ||
      stage.attempt !== input.expectedAttempt ||
      !retryable.has(stage.stageKey)
    ) {
      throw new ApplicationError('STAGE_NOT_RETRYABLE', 409, 'The stage is not retryable.');
    }
    await this.workflowPort.assertAvailable();
    await this.workflowPort.retry({
      runId: input.runId,
      stageKey: input.stageKey,
      attempt: input.expectedAttempt + 1,
      requestId: context.requestId,
    });
    const event = await this.transactions.run(async (repositories) => {
      const next = await repositories.stages.create({
        runId: input.runId,
        stageKey: stage.stageKey,
        attempt: stage.attempt + 1,
        status: 'PENDING',
        dependencyKeysJson: stage.dependencyKeysJson,
        inputHash: stage.inputHash,
      });
      return this.eventService.append(repositories, {
        runId: input.runId,
        stageId: next.id,
        eventType: 'stage.status_changed',
        level: 'INFO',
        message: 'Stage retry queued.',
        data: {
          runId: input.runId,
          stageKey: stage.stageKey,
          attempt: next.attempt,
          status: 'PENDING',
        },
      });
    });
    this.eventService.publish(event);
    return this.get(input.runId);
  }

  async approveShortlist(input: {
    runId: string;
    decision: 'APPROVE';
    expectedRankingSnapshotHash: string;
    approvedCandidateIds: string[];
    excludedCandidateIds: string[];
    allowEmpty?: boolean;
    note?: string;
  }) {
    const run = await this.requireRun(input.runId);
    if (run.status !== 'AWAITING_SHORTLIST_APPROVAL') {
      throw new ApplicationError(
        'CANDIDATE_NOT_APPROVABLE',
        422,
        'The run is not awaiting shortlist approval.',
      );
    }
    if (input.approvedCandidateIds.length === 0 && !(input.allowEmpty === true && input.note)) {
      throw new ApplicationError(
        'CANDIDATE_NOT_APPROVABLE',
        422,
        'An approved candidate is required.',
      );
    }
    const rankings = await this.repositories.rankingResults.findSnapshot(
      input.runId,
      input.expectedRankingSnapshotHash,
    );
    if (rankings.length === 0) {
      throw new ApplicationError('RANKING_CHANGED', 409, 'The ranking snapshot has changed.');
    }
    const approved = new Set(input.approvedCandidateIds);
    const excluded = new Set(input.excludedCandidateIds);
    if ([...approved].some((id) => excluded.has(id))) {
      throw new ApplicationError('CANDIDATE_NOT_APPROVABLE', 422, 'Candidate selections overlap.');
    }
    const byId = new Map(rankings.map((ranking) => [ranking.candidateId, ranking]));
    for (const id of [...approved, ...excluded]) {
      if (!byId.has(id)) {
        throw new ApplicationError(
          'CANDIDATE_NOT_APPROVABLE',
          422,
          'A candidate is outside the ranking snapshot.',
        );
      }
    }
    if ([...approved].some((id) => byId.get(id)?.category === 'REJECTED')) {
      throw new ApplicationError(
        'CANDIDATE_NOT_APPROVABLE',
        422,
        'Rejected candidates cannot be approved.',
      );
    }
    const at = this.clock();
    const selection = {
      approvedCandidateIds: [...approved].sort(),
      excludedCandidateIds: [...excluded].sort(),
    };
    const event = await this.transactions.run(async (repositories) => {
      await repositories.approvals.create({
        runId: input.runId,
        type: 'SHORTLIST',
        status: 'APPROVED',
        snapshotHash: input.expectedRankingSnapshotHash,
        selectionJson: canonicalJson(JSON.parse(JSON.stringify(selection)) as CanonicalJsonValue),
        ...(input.note === undefined ? {} : { note: input.note }),
        createdAt: at,
      });
      const transitioned = await repositories.runs.transitionControl(
        input.runId,
        ['AWAITING_SHORTLIST_APPROVAL'],
        { status: 'COMPLETED', completedAt: at },
      );
      if (transitioned === null) {
        throw new ApplicationError(
          'RANKING_CHANGED',
          409,
          'The run state changed before approval.',
        );
      }
      return this.eventService.append(repositories, {
        runId: input.runId,
        eventType: 'run.status_changed',
        level: 'INFO',
        message: 'Shortlist approved and run completed.',
        data: { runId: input.runId, status: 'COMPLETED', at: at.toISOString() },
      });
    });
    this.eventService.publish(event);
    return this.get(input.runId);
  }

  private async requireRun(runId: string) {
    const run = await this.repositories.runs.findById(runId);
    if (run === null) throw resourceNotFound('run');
    return run;
  }
}

function stripProjectId(input: { projectId: string } & RunConfiguration): RunConfiguration {
  const { projectId, ...configuration } = input;
  void projectId;
  return configuration;
}

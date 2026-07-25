import type {
  Approval,
  Artifact,
  CacheEntry,
  Candidate,
  ConstraintOutcome,
  EvidenceSummary,
  GraphEdge,
  GraphNode,
  NormalizedObservation,
  PopulationCoverageResult,
  PredictionObservation,
  PredictorExecution,
  Prisma,
  Project,
  ProteinInput,
  RankingResult,
  ShortlistOptimizationResult,
  ShortlistSelectionStep,
  WorkflowEvent,
  WorkflowRun,
  WorkflowStage,
} from '@prisma/client';
import type { z } from 'zod';

import type { RepositoryClient as PrismaClient } from './repository-client.js';
import type {
  CandidateComparisonRecord,
  CandidateDetailRecord,
  CandidatePageRecord,
  CandidateQuery,
  CoverageLookup,
  EventPageQuery,
  EventPageRecord,
  GraphNeighborhoodQuery,
  GraphNeighborhoodRecord,
  ProjectPageItem,
  ProjectPageQuery,
  ProjectPageRecord,
  RunDetailRecord,
  RunSummaryRecord,
  ShortlistRecord,
} from './read-models.js';

import {
  approvalCreateSchema,
  artifactCreateSchema,
  cacheEntryCreateSchema,
  candidateCreateSchema,
  constraintOutcomeCreateSchema,
  evidenceSummaryCreateSchema,
  graphEdgeCreateSchema,
  graphNodeCreateSchema,
  normalizedObservationCreateSchema,
  populationCoverageResultCreateSchema,
  predictionObservationCreateSchema,
  predictorExecutionCreateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  proteinInputCreateSchema,
  rankingResultCreateSchema,
  shortlistOptimizationResultCreateSchema,
  shortlistSelectionStepCreateSchema,
  workflowEventCreateSchema,
  workflowRunControlUpdateSchema,
  workflowRunCreateSchema,
  workflowStageCreateSchema,
} from './validation.js';

export interface ReadRepository<TEntity> {
  findById(id: string): Promise<TEntity | null>;
}

export interface CreateRepository<TEntity, TCreate> extends ReadRepository<TEntity> {
  create(input: TCreate): Promise<TEntity>;
}

export interface RunScopedAppendOnlyRepository<TEntity, TCreate> extends CreateRepository<
  TEntity,
  TCreate
> {
  listByRun(runId: string): Promise<TEntity[]>;
}

export type ProjectCreate = z.input<typeof projectCreateSchema>;
export type ProjectUpdate = z.input<typeof projectUpdateSchema>;
export type ProteinInputCreate = z.input<typeof proteinInputCreateSchema>;
export type WorkflowRunCreate = z.input<typeof workflowRunCreateSchema>;
export type WorkflowRunControlUpdate = z.input<typeof workflowRunControlUpdateSchema>;
export type WorkflowStageCreate = z.input<typeof workflowStageCreateSchema>;
export type WorkflowEventCreate = z.input<typeof workflowEventCreateSchema>;
export type PredictorExecutionCreate = z.input<typeof predictorExecutionCreateSchema>;
export type CandidateCreate = z.input<typeof candidateCreateSchema>;
export type PredictionObservationCreate = z.input<typeof predictionObservationCreateSchema>;
export type NormalizedObservationCreate = z.input<typeof normalizedObservationCreateSchema>;
export type EvidenceSummaryCreate = z.input<typeof evidenceSummaryCreateSchema>;
export type ConstraintOutcomeCreate = z.input<typeof constraintOutcomeCreateSchema>;
export type RankingResultCreate = z.input<typeof rankingResultCreateSchema>;
export type PopulationCoverageResultCreate = z.input<typeof populationCoverageResultCreateSchema>;
export type ShortlistOptimizationResultCreate = z.input<
  typeof shortlistOptimizationResultCreateSchema
>;
export type ShortlistSelectionStepCreate = z.input<typeof shortlistSelectionStepCreateSchema>;
export type ApprovalCreate = z.input<typeof approvalCreateSchema>;
export type ArtifactCreate = z.input<typeof artifactCreateSchema>;
export type GraphNodeCreate = z.input<typeof graphNodeCreateSchema>;
export type GraphEdgeCreate = z.input<typeof graphEdgeCreateSchema>;
export type CacheEntryCreate = z.input<typeof cacheEntryCreateSchema>;

interface Parser<T> {
  parse(input: unknown): T;
}

abstract class PrismaRunScopedAppendOnlyRepository<
  TEntity,
  TCreate,
> implements RunScopedAppendOnlyRepository<TEntity, TCreate> {
  protected constructor(
    private readonly parser: Parser<TCreate>,
    private readonly createRecord: (input: TCreate) => Promise<TEntity>,
    private readonly findRecord: (id: string) => Promise<TEntity | null>,
    private readonly listRecords: (runId: string) => Promise<TEntity[]>,
  ) {}

  create(input: TCreate): Promise<TEntity> {
    return this.createRecord(this.parser.parse(input));
  }

  findById(id: string): Promise<TEntity | null> {
    return this.findRecord(id);
  }

  listByRun(runId: string): Promise<TEntity[]> {
    return this.listRecords(runId);
  }
}

export interface IProjectRepository extends CreateRepository<Project, ProjectCreate> {
  updateMetadata(id: string, input: ProjectUpdate): Promise<Project>;
  listPage(input: ProjectPageQuery): Promise<ProjectPageRecord>;
  countAll(): Promise<number>;
  deleteTree(projectId: string): Promise<void>;
}

export class ProjectRepository implements IProjectRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: ProjectCreate): Promise<Project> {
    const data = projectCreateSchema.parse(input) as Prisma.ProjectUncheckedCreateInput;
    return this.client.project.create({ data });
  }

  findById(id: string): Promise<Project | null> {
    return this.client.project.findUnique({ where: { id } });
  }

  updateMetadata(id: string, input: ProjectUpdate): Promise<Project> {
    const data = projectUpdateSchema.parse(input) as Prisma.ProjectUpdateInput;
    return this.client.project.update({ data, where: { id } });
  }

  async listPage(input: ProjectPageQuery): Promise<ProjectPageRecord> {
    const where: Prisma.ProjectWhereInput | undefined = input.after
      ? {
          OR: [
            { updatedAt: { lt: input.after.updatedAt } },
            { updatedAt: input.after.updatedAt, id: { lt: input.after.id } },
          ],
        }
      : undefined;
    const records = await this.client.project.findMany({
      ...(where === undefined ? {} : { where }),
      include: {
        workflowRuns: {
          include: { predictorExecutions: true },
          orderBy: [{ revision: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    const hasMore = records.length > input.limit;
    const items = records.slice(0, input.limit) as ProjectPageItem[];
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last !== undefined ? { updatedAt: last.updatedAt, id: last.id } : null,
    };
  }

  countAll(): Promise<number> {
    return this.client.project.count();
  }

  async deleteTree(projectId: string): Promise<void> {
    const runs = await this.client.workflowRun.findMany({
      select: { id: true },
      where: { projectId },
    });
    const runIds = runs.map(({ id }) => id);
    if (runIds.length > 0) {
      await this.client.graphEdge.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.graphNode.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.shortlistSelectionStep.deleteMany({
        where: { shortlistOptimizationResult: { runId: { in: runIds } } },
      });
      await this.client.shortlistOptimizationResult.deleteMany({
        where: { runId: { in: runIds } },
      });
      await this.client.populationCoverageResult.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.normalizedObservation.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.predictionObservation.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.predictorExecution.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.evidenceSummary.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.constraintOutcome.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.rankingResult.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.approval.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.artifact.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.workflowEvent.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.candidate.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.workflowStage.deleteMany({ where: { runId: { in: runIds } } });
      await this.client.workflowRun.deleteMany({ where: { id: { in: runIds } } });
    }
    await this.client.proteinInput.deleteMany({ where: { projectId } });
    await this.client.project.delete({ where: { id: projectId } });
  }
}

export interface IProteinInputRepository extends CreateRepository<
  ProteinInput,
  ProteinInputCreate
> {
  listByProject(projectId: string): Promise<ProteinInput[]>;
  findCurrentByProject(projectId: string): Promise<ProteinInput | null>;
}

export class ProteinInputRepository implements IProteinInputRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: ProteinInputCreate): Promise<ProteinInput> {
    const data = proteinInputCreateSchema.parse(input) as Prisma.ProteinInputUncheckedCreateInput;
    return this.client.proteinInput.create({ data });
  }

  findById(id: string): Promise<ProteinInput | null> {
    return this.client.proteinInput.findUnique({ where: { id } });
  }

  listByProject(projectId: string): Promise<ProteinInput[]> {
    return this.client.proteinInput.findMany({
      orderBy: { createdAt: 'asc' },
      where: { projectId },
    });
  }

  findCurrentByProject(projectId: string): Promise<ProteinInput | null> {
    return this.client.proteinInput.findFirst({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      where: { projectId },
    });
  }
}

export interface IWorkflowRunRepository extends CreateRepository<WorkflowRun, WorkflowRunCreate> {
  listByProject(projectId: string): Promise<WorkflowRun[]>;
  updateControl(id: string, input: WorkflowRunControlUpdate): Promise<WorkflowRun>;
  transitionControl(
    id: string,
    expectedStatuses: readonly string[],
    input: WorkflowRunControlUpdate,
  ): Promise<WorkflowRun | null>;
  findDetailById(id: string): Promise<RunDetailRecord | null>;
  listSummariesByProject(projectId: string): Promise<RunSummaryRecord[]>;
  nextRevision(projectId: string): Promise<number>;
  countByStatus(): Promise<Record<string, number>>;
  countCreatedSince(since: Date): Promise<number>;
}

export class WorkflowRunRepository implements IWorkflowRunRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: WorkflowRunCreate): Promise<WorkflowRun> {
    const data = workflowRunCreateSchema.parse(input) as Prisma.WorkflowRunUncheckedCreateInput;
    return this.client.workflowRun.create({ data });
  }

  findById(id: string): Promise<WorkflowRun | null> {
    return this.client.workflowRun.findUnique({ where: { id } });
  }

  listByProject(projectId: string): Promise<WorkflowRun[]> {
    return this.client.workflowRun.findMany({ orderBy: { revision: 'asc' }, where: { projectId } });
  }

  updateControl(id: string, input: WorkflowRunControlUpdate): Promise<WorkflowRun> {
    const data = workflowRunControlUpdateSchema.parse(input) as Prisma.WorkflowRunUpdateInput;
    return this.client.workflowRun.update({ data, where: { id } });
  }

  async transitionControl(
    id: string,
    expectedStatuses: readonly string[],
    input: WorkflowRunControlUpdate,
  ): Promise<WorkflowRun | null> {
    const data = workflowRunControlUpdateSchema.parse(input) as Prisma.WorkflowRunUpdateInput;
    const result = await this.client.workflowRun.updateMany({
      data,
      where: { id, status: { in: [...expectedStatuses] } },
    });
    return result.count === 0 ? null : this.findById(id);
  }

  findDetailById(id: string): Promise<RunDetailRecord | null> {
    return this.client.workflowRun.findUnique({
      where: { id },
      include: {
        approvals: { orderBy: { createdAt: 'asc' } },
        predictorExecutions: { orderBy: { startedAt: 'asc' } },
        rankingResults: { orderBy: { rank: 'asc' } },
        stages: { orderBy: [{ stageKey: 'asc' }, { attempt: 'asc' }] },
      },
    });
  }

  listSummariesByProject(projectId: string): Promise<RunSummaryRecord[]> {
    return this.client.workflowRun.findMany({
      where: { projectId },
      include: { predictorExecutions: true },
      orderBy: [{ revision: 'desc' }, { id: 'desc' }],
    });
  }

  async nextRevision(projectId: string): Promise<number> {
    const result = await this.client.workflowRun.aggregate({
      _max: { revision: true },
      where: { projectId },
    });
    return (result._max.revision ?? 0) + 1;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const groups = await this.client.workflowRun.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    return Object.fromEntries(groups.map((group) => [group.status, group._count._all]));
  }

  countCreatedSince(since: Date): Promise<number> {
    return this.client.workflowRun.count({ where: { createdAt: { gte: since } } });
  }
}

export class WorkflowStageRepository extends PrismaRunScopedAppendOnlyRepository<
  WorkflowStage,
  WorkflowStageCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      workflowStageCreateSchema,
      (input) =>
        queryClient.workflowStage.create({
          data: input as Prisma.WorkflowStageUncheckedCreateInput,
        }),
      (id) => queryClient.workflowStage.findUnique({ where: { id } }),
      (runId) =>
        queryClient.workflowStage.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }

  findLatestByKey(runId: string, stageKey: string): Promise<WorkflowStage | null> {
    return this.queryClient.workflowStage.findFirst({
      where: { runId, stageKey },
      orderBy: [{ attempt: 'desc' }, { id: 'desc' }],
    });
  }
}

export class WorkflowEventRepository extends PrismaRunScopedAppendOnlyRepository<
  WorkflowEvent,
  WorkflowEventCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      workflowEventCreateSchema,
      (input) =>
        queryClient.workflowEvent.create({
          data: input as Prisma.WorkflowEventUncheckedCreateInput,
        }),
      (id) => queryClient.workflowEvent.findUnique({ where: { id } }),
      (runId) =>
        queryClient.workflowEvent.findMany({
          orderBy: { sequenceNumber: 'asc' },
          where: { runId },
        }),
    );
  }

  async appendNext(input: Omit<WorkflowEventCreate, 'sequenceNumber'>): Promise<WorkflowEvent> {
    const maximum = await this.queryClient.workflowEvent.aggregate({
      _max: { sequenceNumber: true },
      where: { runId: input.runId },
    });
    const sequenceNumber = (maximum._max.sequenceNumber ?? 0) + 1;
    const data = workflowEventCreateSchema.parse({
      ...input,
      sequenceNumber,
    }) as Prisma.WorkflowEventUncheckedCreateInput;
    return this.queryClient.workflowEvent.create({ data });
  }

  async listPage(input: EventPageQuery): Promise<EventPageRecord> {
    const records = await this.queryClient.workflowEvent.findMany({
      where: { runId: input.runId, sequenceNumber: { gt: input.afterSequence } },
      orderBy: { sequenceNumber: 'asc' },
      take: input.limit + 1,
    });
    const hasMore = records.length > input.limit;
    const items = records.slice(0, input.limit);
    return {
      items,
      nextSequence: hasMore ? (items.at(-1)?.sequenceNumber ?? null) : null,
    };
  }
}

export class PredictorExecutionRepository extends PrismaRunScopedAppendOnlyRepository<
  PredictorExecution,
  PredictorExecutionCreate
> {
  constructor(client: PrismaClient) {
    super(
      predictorExecutionCreateSchema,
      (input) =>
        client.predictorExecution.create({
          data: input as Prisma.PredictorExecutionUncheckedCreateInput,
        }),
      (id) => client.predictorExecution.findUnique({ where: { id } }),
      (runId) =>
        client.predictorExecution.findMany({ orderBy: { startedAt: 'asc' }, where: { runId } }),
    );
  }
}

export class CandidateRepository extends PrismaRunScopedAppendOnlyRepository<
  Candidate,
  CandidateCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      candidateCreateSchema,
      (input) =>
        queryClient.candidate.create({ data: input as Prisma.CandidateUncheckedCreateInput }),
      (id) => queryClient.candidate.findUnique({ where: { id } }),
      (runId) =>
        queryClient.candidate.findMany({ orderBy: { candidateKey: 'asc' }, where: { runId } }),
    );
  }

  async listRanked(input: CandidateQuery): Promise<CandidatePageRecord> {
    const candidateWhere: Prisma.CandidateWhereInput = {
      ...(input.track === undefined ? {} : { candidateType: input.track }),
      ...(input.allele === undefined ? {} : { allele: input.allele }),
      ...(input.search === undefined
        ? {}
        : {
            OR: [{ id: { contains: input.search } }, { peptide: { contains: input.search } }],
          }),
      ...(input.hasWarnings === undefined
        ? {}
        : {
            constraintOutcomes: input.hasWarnings
              ? { some: { outcome: { in: ['REVIEW', 'FAIL'] } } }
              : { none: { outcome: { in: ['REVIEW', 'FAIL'] } } },
          }),
      ...(input.sourceStatus === undefined
        ? {}
        : {
            predictionObservations: {
              some: { predictorExecution: { sourceStatus: input.sourceStatus } },
            },
          }),
    };
    const cursorWhere: Prisma.RankingResultWhereInput | undefined = input.after
      ? input.sort === 'rank'
        ? {
            OR: [
              { rank: { gt: input.after.rank } },
              { rank: input.after.rank, candidateId: { gt: input.after.id } },
            ],
          }
        : input.sort === 'score'
          ? {
              OR: [
                { finalScore: { lt: input.after.finalScore } },
                { finalScore: input.after.finalScore, candidateId: { gt: input.after.id } },
              ],
            }
          : {
              OR: [
                { candidate: { start: { gt: input.after.start } } },
                { candidate: { start: input.after.start, id: { gt: input.after.id } } },
              ],
            }
      : undefined;
    const orderBy: Prisma.RankingResultOrderByWithRelationInput[] =
      input.sort === 'rank'
        ? [{ rank: 'asc' }, { candidateId: 'asc' }]
        : input.sort === 'score'
          ? [{ finalScore: 'desc' }, { candidateId: 'asc' }]
          : [{ candidate: { start: 'asc' } }, { candidateId: 'asc' }];
    const records = await this.queryClient.rankingResult.findMany({
      where: {
        runId: input.runId,
        snapshotHash: input.rankingSnapshotHash,
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.minScore === undefined ? {} : { finalScore: { gte: input.minScore } }),
        ...(input.maxScore === undefined
          ? {}
          : {
              finalScore: {
                ...(input.minScore === undefined ? {} : { gte: input.minScore }),
                lte: input.maxScore,
              },
            }),
        candidate: candidateWhere,
        ...(cursorWhere ?? {}),
      },
      include: {
        candidate: {
          include: {
            constraintOutcomes: { where: { snapshotHash: input.rankingSnapshotHash } },
            evidenceSummaries: {
              where: { snapshotHash: input.rankingSnapshotHash },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            predictionObservations: { include: { predictorExecution: true } },
          },
        },
      },
      orderBy,
      take: input.limit + 1,
    });
    const hasMore = records.length > input.limit;
    const items = records.slice(0, input.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last !== undefined
          ? {
              rank: last.rank,
              finalScore: last.finalScore,
              start: last.candidate.start,
              id: last.candidateId,
            }
          : null,
    };
  }

  async findDetail(
    runId: string,
    candidateId: string,
    snapshotHash: string,
  ): Promise<CandidateDetailRecord | null> {
    const ranking = await this.queryClient.rankingResult.findFirst({
      where: { runId, candidateId, snapshotHash },
      orderBy: { createdAt: 'desc' },
    });
    if (ranking === null) return null;
    const candidate = await this.queryClient.candidate.findFirst({
      where: { id: candidateId, runId },
      include: {
        constraintOutcomes: { where: { snapshotHash }, orderBy: { ruleId: 'asc' } },
        evidenceSummaries: {
          where: { snapshotHash },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        normalizedObservations: { orderBy: { createdAt: 'asc' } },
        predictionObservations: {
          include: { predictorExecution: true },
          orderBy: { observedAt: 'asc' },
        },
      },
    });
    return candidate === null ? null : { candidate, ranking };
  }

  async findComparison(
    runId: string,
    ids: readonly string[],
    snapshotHash: string,
  ): Promise<CandidateComparisonRecord[]> {
    const rankings = await this.queryClient.rankingResult.findMany({
      where: { runId, snapshotHash, candidateId: { in: [...ids] } },
      include: { candidate: { include: { constraintOutcomes: { where: { snapshotHash } } } } },
      orderBy: { rank: 'asc' },
    });
    return rankings.map((ranking) => ({
      candidate: ranking.candidate,
      ranking: {
        id: ranking.id,
        runId: ranking.runId,
        candidateId: ranking.candidateId,
        snapshotHash: ranking.snapshotHash,
        profileVersion: ranking.profileVersion,
        track: ranking.track,
        componentScoresJson: ranking.componentScoresJson,
        penaltiesJson: ranking.penaltiesJson,
        finalScore: ranking.finalScore,
        category: ranking.category,
        confidence: ranking.confidence,
        rank: ranking.rank,
        createdAt: ranking.createdAt,
      },
      constraints: ranking.candidate.constraintOutcomes,
    }));
  }

  countAll(): Promise<number> {
    return this.queryClient.candidate.count();
  }
}

export class PredictionObservationRepository implements RunScopedAppendOnlyRepository<
  PredictionObservation,
  PredictionObservationCreate
> {
  constructor(private readonly client: PrismaClient) {}

  async create(input: PredictionObservationCreate): Promise<PredictionObservation> {
    const data = predictionObservationCreateSchema.parse(
      input,
    ) as Prisma.PredictionObservationUncheckedCreateInput;
    const execution = await this.client.predictorExecution.findUnique({
      select: { runId: true, sourceStatus: true },
      where: { id: data.predictorExecutionId },
    });
    if (execution === null) throw new Error('Predictor execution does not exist');
    if (execution.sourceStatus === 'FAILED') {
      throw new Error('FAILED predictor executions cannot have scientific observations');
    }
    if (execution.runId !== data.runId) throw new Error('Observation and execution run IDs differ');
    return this.client.predictionObservation.create({ data });
  }

  findById(id: string): Promise<PredictionObservation | null> {
    return this.client.predictionObservation.findUnique({ where: { id } });
  }

  listByRun(runId: string): Promise<PredictionObservation[]> {
    return this.client.predictionObservation.findMany({
      orderBy: { createdAt: 'asc' },
      where: { runId },
    });
  }
}

export class NormalizedObservationRepository extends PrismaRunScopedAppendOnlyRepository<
  NormalizedObservation,
  NormalizedObservationCreate
> {
  constructor(client: PrismaClient) {
    super(
      normalizedObservationCreateSchema,
      (input) =>
        client.normalizedObservation.create({
          data: input as Prisma.NormalizedObservationUncheckedCreateInput,
        }),
      (id) => client.normalizedObservation.findUnique({ where: { id } }),
      (runId) =>
        client.normalizedObservation.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }
}

export class EvidenceSummaryRepository extends PrismaRunScopedAppendOnlyRepository<
  EvidenceSummary,
  EvidenceSummaryCreate
> {
  constructor(client: PrismaClient) {
    super(
      evidenceSummaryCreateSchema,
      (input) =>
        client.evidenceSummary.create({
          data: input as Prisma.EvidenceSummaryUncheckedCreateInput,
        }),
      (id) => client.evidenceSummary.findUnique({ where: { id } }),
      (runId) =>
        client.evidenceSummary.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }
}

export class ConstraintOutcomeRepository extends PrismaRunScopedAppendOnlyRepository<
  ConstraintOutcome,
  ConstraintOutcomeCreate
> {
  constructor(client: PrismaClient) {
    super(
      constraintOutcomeCreateSchema,
      (input) =>
        client.constraintOutcome.create({
          data: input as Prisma.ConstraintOutcomeUncheckedCreateInput,
        }),
      (id) => client.constraintOutcome.findUnique({ where: { id } }),
      (runId) =>
        client.constraintOutcome.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }
}

export class RankingResultRepository extends PrismaRunScopedAppendOnlyRepository<
  RankingResult,
  RankingResultCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      rankingResultCreateSchema,
      (input) =>
        queryClient.rankingResult.create({
          data: input as Prisma.RankingResultUncheckedCreateInput,
        }),
      (id) => queryClient.rankingResult.findUnique({ where: { id } }),
      (runId) => queryClient.rankingResult.findMany({ orderBy: { rank: 'asc' }, where: { runId } }),
    );
  }

  findSnapshot(runId: string, snapshotHash: string): Promise<RankingResult[]> {
    return this.queryClient.rankingResult.findMany({
      where: { runId, snapshotHash },
      orderBy: [{ track: 'asc' }, { rank: 'asc' }],
    });
  }

  async findLatestSnapshotHash(runId: string): Promise<string | null> {
    const latest = await this.queryClient.rankingResult.findFirst({
      where: { runId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { snapshotHash: true },
    });
    return latest?.snapshotHash ?? null;
  }
}

export class PopulationCoverageResultRepository extends PrismaRunScopedAppendOnlyRepository<
  PopulationCoverageResult,
  PopulationCoverageResultCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      populationCoverageResultCreateSchema,
      (input) =>
        queryClient.populationCoverageResult.create({
          data: input as Prisma.PopulationCoverageResultUncheckedCreateInput,
        }),
      (id) => queryClient.populationCoverageResult.findUnique({ where: { id } }),
      (runId) =>
        queryClient.populationCoverageResult.findMany({
          orderBy: { createdAt: 'asc' },
          where: { runId },
        }),
    );
  }

  async findMatch(input: CoverageLookup): Promise<PopulationCoverageResult | null> {
    const records = await this.queryClient.populationCoverageResult.findMany({
      where: {
        runId: input.runId,
        populationId: input.populationId,
        purpose: input.purpose,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return (
      records.find((record) => {
        const candidateIds: unknown = JSON.parse(record.candidateIdsJson);
        if (!Array.isArray(candidateIds)) return false;
        return input.candidateId === undefined
          ? input.purpose !== 'CANDIDATE_RANKING'
          : candidateIds.length === 1 && candidateIds[0] === input.candidateId;
      }) ?? null
    );
  }
}

export class ShortlistOptimizationResultRepository extends PrismaRunScopedAppendOnlyRepository<
  ShortlistOptimizationResult,
  ShortlistOptimizationResultCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      shortlistOptimizationResultCreateSchema,
      (input) =>
        queryClient.shortlistOptimizationResult.create({
          data: input as Prisma.ShortlistOptimizationResultUncheckedCreateInput,
        }),
      (id) => queryClient.shortlistOptimizationResult.findUnique({ where: { id } }),
      (runId) =>
        queryClient.shortlistOptimizationResult.findMany({
          orderBy: { createdAt: 'asc' },
          where: { runId },
        }),
    );
  }

  findLatest(runId: string, track: 'MHCI' | 'MHCII'): Promise<ShortlistRecord | null> {
    return this.queryClient.shortlistOptimizationResult.findFirst({
      where: { runId, track },
      include: {
        finalCoverageResult: true,
        selectionSteps: { orderBy: { step: 'asc' } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}

export interface IShortlistSelectionStepRepository extends CreateRepository<
  ShortlistSelectionStep,
  ShortlistSelectionStepCreate
> {
  listByOptimization(shortlistOptimizationResultId: string): Promise<ShortlistSelectionStep[]>;
}

export class ShortlistSelectionStepRepository implements IShortlistSelectionStepRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: ShortlistSelectionStepCreate): Promise<ShortlistSelectionStep> {
    const data = shortlistSelectionStepCreateSchema.parse(
      input,
    ) as Prisma.ShortlistSelectionStepUncheckedCreateInput;
    return this.client.shortlistSelectionStep.create({ data });
  }

  findById(id: string): Promise<ShortlistSelectionStep | null> {
    return this.client.shortlistSelectionStep.findUnique({ where: { id } });
  }

  listByOptimization(shortlistOptimizationResultId: string): Promise<ShortlistSelectionStep[]> {
    return this.client.shortlistSelectionStep.findMany({
      orderBy: { step: 'asc' },
      where: { shortlistOptimizationResultId },
    });
  }
}

export class ApprovalRepository extends PrismaRunScopedAppendOnlyRepository<
  Approval,
  ApprovalCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      approvalCreateSchema,
      (input) =>
        queryClient.approval.create({ data: input as Prisma.ApprovalUncheckedCreateInput }),
      (id) => queryClient.approval.findUnique({ where: { id } }),
      (runId) => queryClient.approval.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }

  findLatest(runId: string, type: 'CONFIGURATION' | 'SHORTLIST'): Promise<Approval | null> {
    return this.queryClient.approval.findFirst({
      where: { runId, type },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}

export class ArtifactRepository extends PrismaRunScopedAppendOnlyRepository<
  Artifact,
  ArtifactCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      artifactCreateSchema,
      (input) =>
        queryClient.artifact.create({ data: input as Prisma.ArtifactUncheckedCreateInput }),
      (id) => queryClient.artifact.findUnique({ where: { id } }),
      (runId) => queryClient.artifact.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }

  countAll(): Promise<number> {
    return this.queryClient.artifact.count();
  }

  listByProject(projectId: string): Promise<Artifact[]> {
    return this.queryClient.artifact.findMany({
      where: { run: { projectId } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export class GraphNodeRepository extends PrismaRunScopedAppendOnlyRepository<
  GraphNode,
  GraphNodeCreate
> {
  constructor(private readonly queryClient: PrismaClient) {
    super(
      graphNodeCreateSchema,
      (input) =>
        queryClient.graphNode.create({ data: input as Prisma.GraphNodeUncheckedCreateInput }),
      (id) => queryClient.graphNode.findUnique({ where: { id } }),
      (runId) =>
        queryClient.graphNode.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }

  async findNeighborhood(input: GraphNeighborhoodQuery): Promise<GraphNeighborhoodRecord> {
    const [nodes, edges] = await Promise.all([
      this.queryClient.graphNode.findMany({
        where: { runId: input.runId },
        orderBy: { id: 'asc' },
      }),
      this.queryClient.graphEdge.findMany({
        where: { runId: input.runId },
        orderBy: { id: 'asc' },
      }),
    ]);
    if (input.candidateId === undefined) return { nodes, edges };
    const seedIds = new Set(
      nodes.filter((node) => node.entityId === input.candidateId).map((node) => node.id),
    );
    const included = new Set(seedIds);
    let frontier = seedIds;
    for (let currentDepth = 0; currentDepth < input.depth; currentDepth += 1) {
      const next = new Set<string>();
      for (const edge of edges) {
        if (frontier.has(edge.sourceNodeId)) next.add(edge.targetNodeId);
        if (frontier.has(edge.targetNodeId)) next.add(edge.sourceNodeId);
      }
      for (const id of next) included.add(id);
      frontier = next;
    }
    return {
      nodes: nodes.filter((node) => included.has(node.id)),
      edges: edges.filter(
        (edge) => included.has(edge.sourceNodeId) && included.has(edge.targetNodeId),
      ),
    };
  }
}

export class GraphEdgeRepository extends PrismaRunScopedAppendOnlyRepository<
  GraphEdge,
  GraphEdgeCreate
> {
  constructor(client: PrismaClient) {
    super(
      graphEdgeCreateSchema,
      (input) => client.graphEdge.create({ data: input as Prisma.GraphEdgeUncheckedCreateInput }),
      (id) => client.graphEdge.findUnique({ where: { id } }),
      (runId) => client.graphEdge.findMany({ orderBy: { createdAt: 'asc' }, where: { runId } }),
    );
  }
}

export interface ICacheEntryRepository extends CreateRepository<CacheEntry, CacheEntryCreate> {
  findReusable(cacheKey: string, now?: Date): Promise<CacheEntry | null>;
  touch(id: string, accessedAt?: Date): Promise<CacheEntry>;
}

export class CacheEntryRepository implements ICacheEntryRepository {
  constructor(private readonly client: PrismaClient) {}

  create(input: CacheEntryCreate): Promise<CacheEntry> {
    const data = cacheEntryCreateSchema.parse(input) as Prisma.CacheEntryUncheckedCreateInput;
    return this.client.cacheEntry.create({ data });
  }

  findById(id: string): Promise<CacheEntry | null> {
    return this.client.cacheEntry.findUnique({ where: { id } });
  }

  findReusable(cacheKey: string, now = new Date()): Promise<CacheEntry | null> {
    return this.client.cacheEntry.findFirst({ where: { cacheKey, expiresAt: { gt: now } } });
  }

  touch(id: string, accessedAt = new Date()): Promise<CacheEntry> {
    return this.client.cacheEntry.update({ data: { lastAccessedAt: accessedAt }, where: { id } });
  }
}

export class DatabaseHealthRepository {
  constructor(private readonly client: PrismaClient) {}

  async check(): Promise<boolean> {
    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}

export function createRepositories(client: PrismaClient) {
  return {
    projects: new ProjectRepository(client),
    proteins: new ProteinInputRepository(client),
    runs: new WorkflowRunRepository(client),
    stages: new WorkflowStageRepository(client),
    events: new WorkflowEventRepository(client),
    predictorExecutions: new PredictorExecutionRepository(client),
    candidates: new CandidateRepository(client),
    observations: new PredictionObservationRepository(client),
    normalizedObservations: new NormalizedObservationRepository(client),
    evidenceSummaries: new EvidenceSummaryRepository(client),
    constraintOutcomes: new ConstraintOutcomeRepository(client),
    rankingResults: new RankingResultRepository(client),
    populationCoverageResults: new PopulationCoverageResultRepository(client),
    shortlistOptimizationResults: new ShortlistOptimizationResultRepository(client),
    shortlistSelectionSteps: new ShortlistSelectionStepRepository(client),
    approvals: new ApprovalRepository(client),
    artifacts: new ArtifactRepository(client),
    graphNodes: new GraphNodeRepository(client),
    graphEdges: new GraphEdgeRepository(client),
    cacheEntries: new CacheEntryRepository(client),
    databaseHealth: new DatabaseHealthRepository(client),
  } as const;
}

export type Repositories = ReturnType<typeof createRepositories>;

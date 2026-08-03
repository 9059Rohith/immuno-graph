import { validateFasta } from '@immunograph/algorithms';
import {
  loadReferenceBundle,
  type Repositories,
  type TransactionManager,
} from '@immunograph/database';

import type { ArtifactStore } from '../artifact-store.js';
import { decodeProjectCursor } from '../cursor.js';
import { ApplicationError, resourceNotFound } from '../errors.js';
import {
  mapCreatedProject,
  mapProjectDetail,
  mapProjectList,
  type RunSummaryInput,
} from '../mappers/project-mapper.js';
import { projectDeleteResponseSchema } from '../response-schemas.js';
import { ReferenceDataService } from '../reference-data-service.js';

type ProjectRepositories = Pick<
  Repositories,
  'projects' | 'proteins' | 'runs' | 'candidates' | 'artifacts' | 'approvals'
>;

export interface CreateProjectInput {
  name: string;
  organism: string;
  proteinName: string;
  description?: string;
  fasta: string;
  isDemo?: boolean;
  demoExpiresAt?: Date;
}

export class ProjectService {
  constructor(
    private readonly repositories: ProjectRepositories,
    private readonly transactions: TransactionManager,
    private readonly artifactStore: ArtifactStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly referenceData: ReferenceDataService = new ReferenceDataService(
      loadReferenceBundle(),
    ),
  ) {}

  async create(input: CreateProjectInput) {
    if (input.name.trim().length > 120) {
      throw new ApplicationError(
        'INVALID_PROJECT',
        422,
        'Project name exceeds 120 characters.',
        false,
        {
          name: ['Project name must not exceed 120 characters.'],
        },
      );
    }
    const validation = validateFasta(
      input.fasta,
      await this.referenceData.fastaValidationOptions(),
    );
    if (!validation.ok) {
      const first = validation.errors[0];
      const uploadTooLarge = first?.code === 'FASTA_TOO_LARGE';
      throw new ApplicationError(
        uploadTooLarge ? 'SEQUENCE_TOO_LONG' : 'INVALID_FASTA',
        uploadTooLarge ? 413 : 422,
        first?.message ?? 'The FASTA input is invalid.',
        false,
        { fasta: validation.errors.map(({ message }) => message) },
      );
    }
    if (validation.value.header.length === 0 || validation.value.header.length > 500) {
      throw new ApplicationError('INVALID_FASTA', 422, 'The FASTA header is invalid.', false, {
        fasta: ['The FASTA header must contain between 1 and 500 characters.'],
      });
    }
    const created = await this.transactions.run(async (repositories) => {
      const project = await repositories.projects.create({
        name: input.name.trim(),
        organism: input.organism.trim(),
        proteinName: input.proteinName.trim(),
        ...(input.description?.trim() ? { description: input.description.trim() } : {}),
        ...(input.isDemo === undefined ? {} : { isDemo: input.isDemo }),
        ...(input.demoExpiresAt === undefined ? {} : { demoExpiresAt: input.demoExpiresAt }),
      });
      const protein = await repositories.proteins.create({
        projectId: project.id,
        originalFasta: input.fasta,
        header: validation.value.header,
        normalizedSequence: validation.value.normalizedSequence,
        sequenceLength: validation.value.sequenceLength,
        sha256: validation.value.sha256,
        validationProfileVersion: 'mvp-v1.0',
      });
      return { project, protein };
    });
    return mapCreatedProject(created.project, created.protein);
  }

  async list(input: { limit: number; cursor?: string }) {
    const now = this.clock();
    const recentSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [page, projectCount, runCounts, recentRunCount, candidateCount, reportCount] =
      await Promise.all([
        this.repositories.projects.listPage({
          limit: input.limit,
          ...(input.cursor === undefined ? {} : { after: decodeProjectCursor(input.cursor) }),
        }),
        this.repositories.projects.countAll(),
        this.repositories.runs.countByStatus(),
        this.repositories.runs.countCreatedSince(recentSince),
        this.repositories.candidates.countAll(),
        this.repositories.artifacts.countAll(),
      ]);
    return mapProjectList(page.items as never, page.nextCursor, {
      projectCount,
      runCounts: {
        total: Object.values(runCounts).reduce((sum, count) => sum + count, 0),
        running: runCounts.RUNNING ?? 0,
        completed: runCounts.COMPLETED ?? 0,
        failed: runCounts.FAILED ?? 0,
      },
      candidateCount,
      reportCount,
      recentSince: recentSince.toISOString(),
      recentRunCount,
      asOf: now.toISOString(),
    });
  }

  async get(projectId: string) {
    const [project, protein, runs] = await Promise.all([
      this.repositories.projects.findById(projectId),
      this.repositories.proteins.findCurrentByProject(projectId),
      this.repositories.runs.listSummariesByProject(projectId),
    ]);
    if (project === null || protein === null) throw resourceNotFound('project');
    const latestRun = runs[0];
    let latestApproval = null;
    if (latestRun !== undefined) {
      const [configuration, shortlist] = await Promise.all([
        this.repositories.approvals.findLatest(latestRun.id, 'CONFIGURATION'),
        this.repositories.approvals.findLatest(latestRun.id, 'SHORTLIST'),
      ]);
      latestApproval =
        [configuration, shortlist]
          .filter((approval) => approval !== null)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null;
    }
    return mapProjectDetail(project, protein, runs as unknown as RunSummaryInput[], latestApproval);
  }

  async delete(input: { projectId: string; confirmation: 'DELETE'; expectedProjectName: string }) {
    const project = await this.repositories.projects.findById(input.projectId);
    if (project === null) throw resourceNotFound('project');
    if (project.name !== input.expectedProjectName) {
      throw new ApplicationError(
        'PROJECT_NAME_MISMATCH',
        409,
        'The project name confirmation does not match.',
      );
    }
    const artifacts = await this.repositories.artifacts.listByProject(input.projectId);
    await this.transactions.run((repositories) =>
      repositories.projects.deleteTree(input.projectId),
    );
    await this.artifactStore.remove(artifacts);
    return projectDeleteResponseSchema.parse({ projectId: input.projectId, deleted: true });
  }
}

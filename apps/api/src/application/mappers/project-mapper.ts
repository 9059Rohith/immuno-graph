import {
  createdProjectSchema,
  projectDetailSchema,
  projectListSchema,
  type CreatedProject,
  type ProjectDetail,
  type ProjectList,
  type SourceStatus,
} from '@immunograph/shared';

import { encodeProjectCursor } from '../cursor.js';

export interface ProjectRecord {
  id: string;
  name: string;
  organism: string | null;
  proteinName: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProteinRecord {
  id: string;
  header: string;
  sequenceLength: number;
  sha256: string;
  validationProfileVersion: string;
}

export interface RunSummaryInput {
  id: string;
  revision: number;
  status: string;
  quality: string | null;
  updatedAt: Date;
  predictorExecutions: readonly { sourceStatus: string }[];
}

const sourceOrder: SourceStatus[] = ['LIVE', 'CACHED', 'SYNTHETIC', 'FIXTURE', 'FAILED'];
const sourceMix = (executions: readonly { sourceStatus: string }[]): SourceStatus[] => {
  const present = new Set(executions.map(({ sourceStatus }) => sourceStatus));
  return sourceOrder.filter((status) => present.has(status));
};

function projectMetadata(project: ProjectRecord) {
  return {
    id: project.id,
    name: project.name,
    organism: project.organism,
    proteinName: project.proteinName,
    description: project.description,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function proteinMetadata(protein: ProteinRecord) {
  return {
    id: protein.id,
    header: protein.header,
    length: protein.sequenceLength,
    sha256: protein.sha256,
    validationProfile: protein.validationProfileVersion,
    warnings: [] as string[],
  };
}

export function mapCreatedProject(project: ProjectRecord, protein: ProteinRecord): CreatedProject {
  return createdProjectSchema.parse({
    project: projectMetadata(project),
    protein: proteinMetadata(protein),
  });
}

function mapRunSummary(run: RunSummaryInput) {
  return {
    id: run.id,
    revision: run.revision,
    status: run.status,
    quality: run.quality,
    sourceMix: sourceMix(run.predictorExecutions),
    updatedAt: run.updatedAt.toISOString(),
  };
}

export function mapProjectDetail(
  project: ProjectRecord,
  protein: ProteinRecord,
  runs: readonly RunSummaryInput[],
  latestApproval: { type: string; status: string; createdAt: Date } | null,
): ProjectDetail {
  const latestRun = runs[0];
  const requiredKind =
    latestRun?.status === 'DRAFT' || latestRun?.status === 'AWAITING_CONFIGURATION_APPROVAL'
      ? 'CONFIGURATION'
      : latestRun?.status === 'AWAITING_SHORTLIST_APPROVAL'
        ? 'SHORTLIST'
        : null;
  const approval =
    latestApproval === null
      ? requiredKind === null
        ? null
        : { kind: requiredKind, status: 'REQUIRED', approvedAt: null }
      : {
          kind: latestApproval.type,
          status: latestApproval.status === 'APPROVED' ? 'APPROVED' : 'REQUIRED',
          approvedAt:
            latestApproval.status === 'APPROVED' ? latestApproval.createdAt.toISOString() : null,
        };
  return projectDetailSchema.parse({
    project: projectMetadata(project),
    protein: proteinMetadata(protein),
    runs: runs.map(mapRunSummary),
    latestApproval: approval,
  });
}

export function mapProjectList(
  items: readonly (ProjectRecord & { workflowRuns: RunSummaryInput[] })[],
  nextCursor: { updatedAt: Date; id: string } | null,
  totals: ProjectList['portfolioSummary'],
): ProjectList {
  return projectListSchema.parse({
    items: items.map((project) => {
      const latestRun = project.workflowRuns[0] ?? null;
      const mix = latestRun === null ? [] : sourceMix(latestRun.predictorExecutions);
      return {
        id: project.id,
        name: project.name,
        organism: project.organism,
        proteinName: project.proteinName,
        latestRun: latestRun === null ? null : mapRunSummary(latestRun),
        sourceMix: mix,
        updatedAt: project.updatedAt.toISOString(),
      };
    }),
    nextCursor: nextCursor === null ? null : encodeProjectCursor(nextCursor),
    portfolioSummary: totals,
  });
}

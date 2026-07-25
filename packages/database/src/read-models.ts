import type {
  Candidate,
  GraphEdge,
  GraphNode,
  PopulationCoverageResult,
  Prisma,
  WorkflowEvent,
} from '@prisma/client';

export interface OrderedCursor {
  updatedAt: Date;
  id: string;
}

export interface ProjectPageQuery {
  limit: number;
  after?: OrderedCursor;
}

export type ProjectPageItem = Prisma.ProjectGetPayload<{
  include: {
    workflowRuns: { include: { predictorExecutions: true } };
  };
}>;

export interface ProjectPageRecord {
  items: ProjectPageItem[];
  nextCursor: OrderedCursor | null;
}

export type RunDetailRecord = Prisma.WorkflowRunGetPayload<{
  include: {
    approvals: true;
    predictorExecutions: true;
    rankingResults: true;
    stages: true;
  };
}>;

export type RunSummaryRecord = Prisma.WorkflowRunGetPayload<{
  include: { predictorExecutions: true };
}>;

export interface CandidatePageCursor {
  rank: number;
  finalScore: number;
  start: number;
  id: string;
}

export interface CandidateQuery {
  runId: string;
  rankingSnapshotHash: string;
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
  after?: CandidatePageCursor;
}

export type RankedCandidateRecord = Prisma.RankingResultGetPayload<{
  include: {
    candidate: {
      include: {
        constraintOutcomes: true;
        evidenceSummaries: true;
        predictionObservations: { include: { predictorExecution: true } };
      };
    };
  };
}>;

export interface CandidatePageRecord {
  items: RankedCandidateRecord[];
  nextCursor: CandidatePageCursor | null;
}

export type CandidateDetailRecord = {
  candidate: Prisma.CandidateGetPayload<{
    include: {
      constraintOutcomes: true;
      evidenceSummaries: true;
      normalizedObservations: true;
      predictionObservations: { include: { predictorExecution: true } };
    };
  }>;
  ranking: Prisma.RankingResultGetPayload<Record<string, never>>;
};

export interface EventPageQuery {
  runId: string;
  afterSequence: number;
  limit: number;
}

export interface EventPageRecord {
  items: WorkflowEvent[];
  nextSequence: number | null;
}

export interface CoverageLookup {
  runId: string;
  populationId: string;
  purpose: 'CANDIDATE_RANKING' | 'SHORTLIST_OPTIMIZATION' | 'FINAL_SHORTLIST';
  candidateId?: string;
}

export type ShortlistRecord = Prisma.ShortlistOptimizationResultGetPayload<{
  include: { finalCoverageResult: true; selectionSteps: true };
}>;

export interface GraphNeighborhoodQuery {
  runId: string;
  candidateId?: string;
  depth: number;
}

export interface GraphNeighborhoodRecord {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CandidateComparisonRecord {
  candidate: Candidate;
  ranking: Prisma.RankingResultGetPayload<Record<string, never>>;
  constraints: Prisma.ConstraintOutcomeGetPayload<Record<string, never>>[];
}

export interface CoverageCollection {
  records: PopulationCoverageResult[];
}

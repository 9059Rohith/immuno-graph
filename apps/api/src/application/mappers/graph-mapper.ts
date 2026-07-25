import type { GraphNeighborhoodRecord, RunDetailRecord } from '@immunograph/database';
import {
  coverageVisualizationSchema,
  graphSchema,
  sequenceMapSchema,
  type SourceStatus,
} from '@immunograph/shared';
import type {
  ConstraintOutcome,
  PopulationCoverageResult,
  PredictorExecution,
  RankingResult,
} from '@prisma/client';

import {
  coverageProvenanceSchema,
  graphEdgePropertiesSchema,
  graphNodePropertiesSchema,
} from '../json.js';
import {
  connectorStatusResponseSchema,
  constraintSummaryResponseSchema,
  scoreDistributionResponseSchema,
} from '../response-schemas.js';
import { WORKFLOW_STAGE_BY_KEY, WORKFLOW_STAGE_DEFINITIONS } from '../workflow-definition.js';

export function mapEvidenceGraph(record: GraphNeighborhoodRecord, generatedAt: Date) {
  const orderedNodes = [...record.nodes].sort((left, right) => left.id.localeCompare(right.id));
  return graphSchema.parse({
    version: '1',
    nodes: orderedNodes.map((node, index) => {
      const properties = graphNodePropertiesSchema.parse(JSON.parse(node.propertiesJson));
      return {
        id: node.id,
        type: node.nodeType,
        position: properties.position ?? { x: (index % 4) * 260, y: Math.floor(index / 4) * 150 },
        data: {
          label: node.label,
          subtitle: properties.subtitle,
          status: properties.status,
          sourceStatus: properties.sourceStatus,
          warningCode: properties.warningCode,
          detailLines: properties.detailLines,
        },
      };
    }),
    edges: record.edges.map((edge) => {
      const properties = graphEdgePropertiesSchema.parse(JSON.parse(edge.propertiesJson));
      return {
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        label: properties.label,
        relation: edge.edgeType,
        provenance: properties.provenance,
      };
    }),
    generatedAt: generatedAt.toISOString(),
  });
}

interface RelationalEvidenceProtein {
  id: string;
  header: string;
  sequenceLength: number;
}

interface RelationalEvidenceCandidate {
  id: string;
  candidateType: string;
  peptide: string;
  start: number;
  end: number;
  allele: string | null;
}

interface RelationalEvidenceRanking {
  id: string;
  candidateId: string;
  category: string;
  finalScore: number;
  rank: number;
}

export function mapRelationalEvidenceGraph(
  input: {
    protein: RelationalEvidenceProtein;
    candidates: readonly RelationalEvidenceCandidate[];
    rankings: readonly RelationalEvidenceRanking[];
    candidateId?: string;
  },
  generatedAt: Date,
) {
  const candidates = input.candidates
    .filter((candidate) => input.candidateId === undefined || candidate.id === input.candidateId)
    .sort(
      (left, right) =>
        left.candidateType.localeCompare(right.candidateType) ||
        left.start - right.start ||
        left.id.localeCompare(right.id),
    );
  const candidateIds = new Set(candidates.map(({ id }) => id));
  const rankings = input.rankings.filter(({ candidateId }) => candidateIds.has(candidateId));
  const allelePositions = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.allele !== null && !allelePositions.has(candidate.allele)) {
      allelePositions.set(candidate.allele, allelePositions.size);
    }
  }
  const nodes = [
    {
      id: `protein:${input.protein.id}`,
      type: 'PROTEIN',
      position: { x: 0, y: Math.max(80, ((candidates.length - 1) * 190) / 2) },
      data: {
        label: input.protein.header,
        subtitle: `${input.protein.sequenceLength} residues`,
        status: 'PERSISTED',
        sourceStatus: null,
        warningCode: null,
        detailLines: ['Relational evidence projection'],
      },
    },
    ...candidates.map((candidate, index) => ({
      id: `candidate:${candidate.id}`,
      type: 'CANDIDATE',
      position: { x: 330, y: index * 190 },
      data: {
        label: candidate.peptide,
        subtitle: `${candidate.candidateType} · ${candidate.start}–${candidate.end}`,
        status: rankings.find((ranking) => ranking.candidateId === candidate.id)?.category ?? null,
        sourceStatus: null,
        warningCode: null,
        detailLines: [candidate.allele ?? 'Allele-independent region'],
      },
    })),
    ...rankings.map((ranking) => {
      const candidateIndex = Math.max(
        0,
        candidates.findIndex(({ id }) => id === ranking.candidateId),
      );
      return {
        id: `ranking:${ranking.id}`,
        type: 'RANKING_RESULT',
        position: { x: 680, y: candidateIndex * 190 },
        data: {
          label: `${ranking.category} · rank ${ranking.rank}`,
          subtitle: `Final score ${ranking.finalScore.toFixed(2)}`,
          status: ranking.category,
          sourceStatus: null,
          warningCode: null,
          detailLines: ['Persisted ranking result'],
        },
      };
    }),
    ...[...allelePositions.entries()].map(([allele, index]) => ({
      id: `allele:${allele}`,
      type: 'HLA_ALLELE',
      position: { x: 1010, y: index * 150 + 40 },
      data: {
        label: allele,
        subtitle: 'Configured restriction',
        status: 'PERSISTED',
        sourceStatus: null,
        warningCode: null,
        detailLines: ['Derived from candidate foreign-key data'],
      },
    })),
  ];
  const edges = [
    ...candidates.map((candidate) => ({
      id: `protein:${input.protein.id}->candidate:${candidate.id}`,
      source: `protein:${input.protein.id}`,
      target: `candidate:${candidate.id}`,
      label: 'has candidate',
      relation: 'HAS_CANDIDATE',
      provenance: 'Persisted relational evidence',
    })),
    ...rankings.map((ranking) => ({
      id: `candidate:${ranking.candidateId}->ranking:${ranking.id}`,
      source: `candidate:${ranking.candidateId}`,
      target: `ranking:${ranking.id}`,
      label: 'ranked as',
      relation: 'RANKED_AS',
      provenance: 'Persisted relational evidence',
    })),
    ...candidates
      .filter((candidate) => candidate.allele !== null)
      .map((candidate) => ({
        id: `candidate:${candidate.id}->allele:${candidate.allele}`,
        source: `candidate:${candidate.id}`,
        target: `allele:${candidate.allele}`,
        label: 'restricted to',
        relation: 'RESTRICTED_TO',
        provenance: 'Persisted relational evidence',
      })),
  ];
  return graphSchema.parse({
    version: '1',
    nodes,
    edges,
    generatedAt: generatedAt.toISOString(),
  });
}

export function mapWorkflowGraph(record: RunDetailRecord, generatedAt: Date) {
  interface WorkflowGraphStage {
    id: string;
    stageKey: string;
    attempt: number;
    status: string;
    dependencyKeysJson: string;
  }
  const latest = new Map<string, WorkflowGraphStage>();
  for (const stage of record.stages) {
    const current = latest.get(stage.stageKey);
    if (current === undefined || stage.attempt > current.attempt) latest.set(stage.stageKey, stage);
  }
  const plannedStatus = (stageKey: string) => {
    if (record.status === 'COMPLETED' && stageKey === 'shortlist_approval') return 'SUCCEEDED';
    if (record.status === 'AWAITING_SHORTLIST_APPROVAL' && stageKey === 'shortlist_approval')
      return 'PENDING';
    return ['DRAFT', 'AWAITING_CONFIGURATION_APPROVAL', 'QUEUED', 'RUNNING'].includes(record.status)
      ? 'PENDING'
      : 'NOT_RECORDED';
  };
  const sourceStages: WorkflowGraphStage[] =
    latest.size > 0
      ? [...latest.values()]
      : WORKFLOW_STAGE_DEFINITIONS.map((definition) => ({
          id: definition.key,
          stageKey: definition.key,
          attempt: 1,
          status: plannedStatus(definition.key),
          dependencyKeysJson: JSON.stringify(definition.dependencies),
        }));
  const stages = sourceStages.sort((left, right) => left.stageKey.localeCompare(right.stageKey));
  const stageByKey = new Map(stages.map((stage) => [stage.stageKey, stage]));
  const dependenciesByKey = new Map(
    stages.map((stage) => {
      const dependencies: unknown = JSON.parse(stage.dependencyKeysJson);
      if (!Array.isArray(dependencies)) throw new Error('Stage dependency keys must be an array');
      return [
        stage.stageKey,
        dependencies.filter((key): key is string => typeof key === 'string' && stageByKey.has(key)),
      ] as const;
    }),
  );
  const inferredColumns = new Map<string, number>();
  const inferColumn = (key: string, visiting = new Set<string>()): number => {
    const known = WORKFLOW_STAGE_BY_KEY.get(key)?.column;
    if (known !== undefined) return known;
    const memoized = inferredColumns.get(key);
    if (memoized !== undefined) return memoized;
    if (visiting.has(key)) return 0;
    const nextVisiting = new Set(visiting).add(key);
    const dependencies = dependenciesByKey.get(key) ?? [];
    const column =
      dependencies.length === 0
        ? 0
        : Math.max(...dependencies.map((dependency) => inferColumn(dependency, nextVisiting))) + 1;
    inferredColumns.set(key, column);
    return column;
  };
  const rowsByColumn = new Map<number, string[]>();
  for (const stage of stages) {
    const column = inferColumn(stage.stageKey);
    const rows = rowsByColumn.get(column) ?? [];
    rows.push(stage.stageKey);
    rows.sort((left, right) => left.localeCompare(right));
    rowsByColumn.set(column, rows);
  }
  return graphSchema.parse({
    version: '1',
    nodes: stages.map((stage) => {
      const column = inferColumn(stage.stageKey);
      const row = rowsByColumn.get(column)?.indexOf(stage.stageKey) ?? 0;
      const effectiveStatus =
        stage.stageKey === 'shortlist_approval' && record.status === 'COMPLETED'
          ? 'SUCCEEDED'
          : stage.status;
      return {
        id: stage.stageKey,
        type: 'workflow-stage',
        position: { x: column * 280, y: row * 150 },
        data: {
          label: WORKFLOW_STAGE_BY_KEY.get(stage.stageKey)?.label ?? stage.stageKey,
          subtitle: `Attempt ${stage.attempt}`,
          status: effectiveStatus,
          sourceStatus:
            (record.predictorExecutions.find((execution) => execution.stageId === stage.id)
              ?.sourceStatus as SourceStatus | undefined) ?? null,
          warningCode: null,
          detailLines: dependenciesByKey.get(stage.stageKey)?.length
            ? [`Depends on ${dependenciesByKey.get(stage.stageKey)!.length} stage(s)`]
            : ['Workflow entry point'],
        },
      };
    }),
    edges: stages.flatMap((stage) => {
      return (dependenciesByKey.get(stage.stageKey) ?? []).map((key) => ({
        id: `${key}->${stage.stageKey}`,
        source: key,
        target: stage.stageKey,
        label: null,
        relation: 'depends_on',
        provenance: null,
      }));
    }),
    generatedAt: generatedAt.toISOString(),
  });
}

interface SequenceCandidate {
  id: string;
  candidateType: string;
  start: number;
  end: number;
  peptide: string;
  category: string;
}

export function mapSequenceMap(
  proteinLength: number,
  candidates: readonly SequenceCandidate[],
  generatedAt: Date,
) {
  const trackOrder = ['MHCI', 'MHCII', 'BCELL'];
  const present = new Set(candidates.map(({ candidateType }) => candidateType));
  return sequenceMapSchema.parse({
    version: '1',
    proteinLength,
    tracks: trackOrder
      .filter((track) => present.has(track))
      .map((track) => ({ id: track, label: track })),
    segments: candidates.map((candidate, index) => ({
      candidateId: candidate.id,
      trackId: candidate.candidateType,
      start: candidate.start,
      end: candidate.end,
      category: candidate.category,
      label: candidate.peptide,
      lane: index % 4,
    })),
    generatedAt: generatedAt.toISOString(),
  });
}

export function mapCoverageVisualization(
  records: readonly PopulationCoverageResult[],
  generatedAt: Date,
) {
  return coverageVisualizationSchema.parse({
    version: '1',
    populations: records.map((record) => {
      const provenance = coverageProvenanceSchema.parse(JSON.parse(record.provenanceJson));
      const classMode = ['CLASS_I', 'CLASS_II', 'COMBINED'].includes(record.classMode)
        ? record.classMode
        : 'COMBINED';
      return {
        populationId: record.populationId,
        label: record.populationId,
        classMode,
        coverage: {
          value: record.projectedCoverage,
          unavailableReason: null,
          sourceStatus: provenance.sourceStatus,
        },
        method: provenance.method,
        observedAt: record.createdAt.toISOString(),
      };
    }),
    generatedAt: generatedAt.toISOString(),
  });
}

export function mapConstraintSummary(records: readonly ConstraintOutcome[], generatedAt: Date) {
  return constraintSummaryResponseSchema.parse({
    version: '1',
    outcomes: ['PASS', 'REVIEW', 'FAIL'].map((outcome) => ({
      outcome,
      count: records.filter((record) => record.outcome === outcome).length,
    })),
    generatedAt: generatedAt.toISOString(),
  });
}

export function mapScoreDistribution(records: readonly RankingResult[], generatedAt: Date) {
  const bins = Array.from({ length: 10 }, (_, index) => ({
    minimum: index / 10,
    maximum: (index + 1) / 10,
    count: 0,
  }));
  for (const record of records) {
    const index = Math.min(9, Math.max(0, Math.floor(record.finalScore * 10)));
    bins[index]!.count += 1;
  }
  return scoreDistributionResponseSchema.parse({
    version: '1',
    bins,
    generatedAt: generatedAt.toISOString(),
  });
}

export function mapConnectorStatus(records: readonly PredictorExecution[], generatedAt: Date) {
  const grouped = new Map<
    string,
    { connectorId: string; method: string; sourceStatus: SourceStatus; count: number }
  >();
  for (const record of records) {
    const key = `${record.connectorId}\u0000${record.method}\u0000${record.sourceStatus}`;
    const current = grouped.get(key);
    if (current === undefined) {
      grouped.set(key, {
        connectorId: record.connectorId,
        method: record.method,
        sourceStatus: record.sourceStatus as SourceStatus,
        count: 1,
      });
    } else current.count += 1;
  }
  return connectorStatusResponseSchema.parse({
    version: '1',
    connectors: [...grouped.values()],
    generatedAt: generatedAt.toISOString(),
  });
}

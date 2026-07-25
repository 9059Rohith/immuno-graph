import { canonicalJson, type CanonicalJsonValue } from '@immunograph/algorithms';
import type { Repositories } from '@immunograph/database';

import type { ArtifactStore } from './artifact-store.js';

type SupplementalArtifactRepositories = Pick<
  Repositories,
  'artifacts' | 'events' | 'graphEdges' | 'graphNodes' | 'stages'
>;

export interface SupplementalArtifactOptions {
  runId: string;
  rankingSnapshotHash: string;
  requestSuffix: string;
  templateVersion: string;
  includeEvidenceGraph: boolean;
  includeWorkflowTrace: boolean;
}

export async function createSupplementalReportArtifacts(
  repositories: SupplementalArtifactRepositories,
  artifactStore: ArtifactStore,
  options: SupplementalArtifactOptions,
): Promise<void> {
  if (options.includeEvidenceGraph) {
    await createEvidenceGraphArtifact(repositories, artifactStore, options);
  }
  if (options.includeWorkflowTrace) {
    await createWorkflowTraceArtifact(repositories, artifactStore, options);
  }
}

async function createEvidenceGraphArtifact(
  repositories: SupplementalArtifactRepositories,
  artifactStore: ArtifactStore,
  options: SupplementalArtifactOptions,
): Promise<void> {
  const [nodes, edges] = await Promise.all([
    repositories.graphNodes.listByRun(options.runId),
    repositories.graphEdges.listByRun(options.runId),
  ]);
  const contents = canonicalJson({
    schemaVersion: 'immunograph-evidence-graph.v1',
    runId: options.runId,
    rankingSnapshotHash: options.rankingSnapshotHash,
    generatedAt: new Date().toISOString(),
    nodes: nodes.map((node) => ({
      id: node.id,
      nodeType: node.nodeType,
      entityId: node.entityId,
      label: node.label,
      properties: parseJson(node.propertiesJson),
      createdAt: node.createdAt.toISOString(),
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      edgeType: edge.edgeType,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      properties: parseJson(edge.propertiesJson),
      createdAt: edge.createdAt.toISOString(),
    })),
  } as unknown as CanonicalJsonValue);
  const file = await artifactStore.write(
    `${options.runId}/evidence-graph-${options.rankingSnapshotHash.slice(0, 12)}-${options.requestSuffix}.json`,
    contents,
    'application/json',
  );
  await repositories.artifacts.create({
    runId: options.runId,
    type: 'EVIDENCE_GRAPH',
    format: 'JSON',
    ...file,
    templateVersion: options.templateVersion,
  });
}

async function createWorkflowTraceArtifact(
  repositories: SupplementalArtifactRepositories,
  artifactStore: ArtifactStore,
  options: SupplementalArtifactOptions,
): Promise<void> {
  const [stages, events] = await Promise.all([
    repositories.stages.listByRun(options.runId),
    repositories.events.listByRun(options.runId),
  ]);
  const contents = canonicalJson({
    schemaVersion: 'immunograph-workflow-trace.v1',
    runId: options.runId,
    rankingSnapshotHash: options.rankingSnapshotHash,
    generatedAt: new Date().toISOString(),
    stages: stages.map((stage) => ({
      id: stage.id,
      stageKey: stage.stageKey,
      attempt: stage.attempt,
      status: stage.status,
      dependencyKeys: parseJson(stage.dependencyKeysJson),
      inputHash: stage.inputHash,
      outputHash: stage.outputHash,
      progress: stage.progress,
      startedAt: stage.startedAt?.toISOString() ?? null,
      completedAt: stage.completedAt?.toISOString() ?? null,
      createdAt: stage.createdAt.toISOString(),
    })),
    events: events.map((event) => ({
      id: event.id,
      sequenceNumber: event.sequenceNumber,
      eventType: event.eventType,
      level: event.level,
      message: event.message,
      payload: parseJson(event.payloadJson),
      stageId: event.stageId,
      createdAt: event.createdAt.toISOString(),
    })),
  } as unknown as CanonicalJsonValue);
  const file = await artifactStore.write(
    `${options.runId}/workflow-trace-${options.rankingSnapshotHash.slice(0, 12)}-${options.requestSuffix}.json`,
    contents,
    'application/json',
  );
  await repositories.artifacts.create({
    runId: options.runId,
    type: 'WORKFLOW_TRACE',
    format: 'JSON',
    ...file,
    templateVersion: options.templateVersion,
  });
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

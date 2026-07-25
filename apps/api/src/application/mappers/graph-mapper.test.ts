import { describe, expect, it } from 'vitest';

import { graphSchema, sequenceMapSchema } from '@immunograph/shared';

import { mapEvidenceGraph, mapSequenceMap, mapWorkflowGraph } from './graph-mapper.js';

describe('graph mapper', () => {
  it('preserves stored relationships and assigns display-only positions', () => {
    const generatedAt = new Date('2026-07-24T00:00:00.000Z');
    const mapped = mapEvidenceGraph(
      {
        nodes: [
          {
            id: 'node-1',
            runId: 'run',
            nodeType: 'candidate',
            entityId: 'candidate',
            label: 'Candidate',
            propertiesJson: '{}',
            createdAt: generatedAt,
          },
          {
            id: 'node-2',
            runId: 'run',
            nodeType: 'observation',
            entityId: 'observation',
            label: 'Observation',
            propertiesJson: '{}',
            createdAt: generatedAt,
          },
        ],
        edges: [
          {
            id: 'edge-1',
            runId: 'run',
            edgeType: 'SUPPORTED_BY',
            sourceNodeId: 'node-1',
            targetNodeId: 'node-2',
            propertiesJson: '{}',
            createdAt: generatedAt,
          },
        ],
      },
      generatedAt,
    );
    expect(graphSchema.parse(mapped)).toEqual(mapped);
    expect(mapped.edges).toHaveLength(1);
  });

  it('maps positional candidates without collapsing identical sequences', () => {
    const generatedAt = new Date('2026-07-24T00:00:00.000Z');
    const mapped = mapSequenceMap(
      20,
      [
        {
          id: '00000000-0000-4000-8000-000000000006',
          candidateType: 'MHCI',
          start: 1,
          end: 9,
          peptide: 'ACDEFGHIK',
          category: 'RECOMMENDED',
        },
        {
          id: '00000000-0000-4000-8000-000000000007',
          candidateType: 'MHCI',
          start: 2,
          end: 10,
          peptide: 'ACDEFGHIK',
          category: 'REVIEW',
        },
      ],
      generatedAt,
    );
    expect(sequenceMapSchema.parse(mapped)).toEqual(mapped);
    expect(mapped.segments).toHaveLength(2);
  });

  it('lays workflow dependencies out from left to right regardless of stage-key sorting', () => {
    const generatedAt = new Date('2026-07-24T00:00:00.000Z');
    const stage = (id: string, stageKey: string, dependencies: string[]) => ({
      id,
      runId: 'run',
      stageKey,
      attempt: 1,
      status: 'SUCCEEDED',
      dependencyKeysJson: JSON.stringify(dependencies),
      inputHash: 'a'.repeat(64),
      outputHash: 'b'.repeat(64),
      progress: 1,
      errorCode: null,
      startedAt: generatedAt,
      completedAt: generatedAt,
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });
    const mapped = mapWorkflowGraph(
      {
        stages: [
          stage('stage-3', 'final_ranking', ['predict_mhci']),
          stage('stage-2', 'predict_mhci', ['validate_input']),
          stage('stage-1', 'validate_input', []),
        ],
        predictorExecutions: [],
      } as never,
      generatedAt,
    );
    const x = (id: string) => mapped.nodes.find((node) => node.id === id)!.position.x;

    expect(x('validate_input')).toBeLessThan(x('predict_mhci'));
    expect(x('predict_mhci')).toBeLessThan(x('final_ranking'));
    expect(mapped.edges).toHaveLength(2);
  });

  it('returns the immutable pending workflow plan before stage attempts exist', () => {
    const generatedAt = new Date('2026-07-24T00:00:00.000Z');
    const mapped = mapWorkflowGraph(
      { status: 'DRAFT', stages: [], predictorExecutions: [] } as never,
      generatedAt,
    );

    expect(mapped.nodes.length).toBeGreaterThanOrEqual(16);
    expect(mapped.edges.length).toBeGreaterThanOrEqual(15);
    expect(mapped.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'validate_input',
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
        expect.objectContaining({
          id: 'final_ranking',
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
        expect.objectContaining({
          id: 'shortlist_approval',
          data: expect.objectContaining({ status: 'PENDING' }),
        }),
      ]),
    );
  });

  it('projects shortlist approval as succeeded after the run completes', () => {
    const generatedAt = new Date('2026-07-24T00:00:00.000Z');
    const mapped = mapWorkflowGraph(
      {
        status: 'COMPLETED',
        predictorExecutions: [],
        stages: [
          {
            id: 'approval-stage',
            stageKey: 'shortlist_approval',
            attempt: 1,
            status: 'PENDING',
            dependencyKeysJson: '[]',
          },
        ],
      } as never,
      generatedAt,
    );

    expect(mapped.nodes[0]?.data.status).toBe('SUCCEEDED');
  });
});

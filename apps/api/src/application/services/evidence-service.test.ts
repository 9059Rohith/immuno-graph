import { describe, expect, it } from 'vitest';

import { EvidenceService } from './evidence-service.js';

const runId = '00000000-0000-4000-8000-000000000001';
const generatedAt = new Date('2026-07-24T00:00:00.000Z');

describe('EvidenceService', () => {
  it('returns only persisted evidence nodes and edges', async () => {
    const repositories = {
      runs: { findById: async () => ({ id: runId }) },
      graphNodes: {
        findNeighborhood: async () => ({
          nodes: [
            {
              id: 'n1',
              runId,
              nodeType: 'candidate',
              entityId: 'candidate',
              label: 'Candidate',
              propertiesJson: '{}',
              createdAt: generatedAt,
            },
          ],
          edges: [],
        }),
      },
    };
    const service = new EvidenceService(repositories as never, () => generatedAt);
    const graph = await service.evidence({ runId, depth: 2 });
    expect(graph.nodes.map(({ id }) => id)).toEqual(['n1']);
    expect(graph.edges).toEqual([]);
  });

  it('rejects visualization requests for a missing run', async () => {
    const service = new EvidenceService(
      { runs: { findById: async () => null } } as never,
      () => generatedAt,
    );
    await expect(service.visualization({ runId, type: 'sequence-map' })).rejects.toMatchObject({
      code: 'RESOURCE_NOT_FOUND',
      statusCode: 404,
    });
  });
});

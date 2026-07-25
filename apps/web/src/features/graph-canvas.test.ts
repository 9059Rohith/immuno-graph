import type { GraphView } from '@immunograph/shared';
import { describe, expect, it } from 'vitest';

import { createGraphElements } from './graph-elements';

const graph: GraphView = {
  version: '1',
  generatedAt: '2026-07-24T00:00:00.000Z',
  nodes: [
    {
      id: 'candidate-1',
      type: 'CANDIDATE',
      position: { x: 280, y: 100 },
      data: {
        label: 'ACDEFGHIK',
        subtitle: 'MHCI · 1–9',
        status: 'RECOMMENDED',
        sourceStatus: 'FIXTURE',
        warningCode: null,
        detailLines: ['HLA-A*02:01'],
      },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'protein-1',
      target: 'candidate-1',
      label: 'has candidate',
      relation: 'HAS_CANDIDATE',
      provenance: 'Stored relation',
    },
  ],
};

describe('graph canvas view model', () => {
  it('preserves scientific metadata and makes edge direction explicit', () => {
    const elements = createGraphElements(graph);

    expect(elements.nodes[0]).toMatchObject({
      id: 'candidate-1',
      type: 'scientific',
      data: {
        nodeType: 'CANDIDATE',
        label: 'ACDEFGHIK',
        status: 'RECOMMENDED',
        sourceStatus: 'FIXTURE',
      },
    });
    expect(elements.edges[0]).toMatchObject({
      type: 'smoothstep',
      label: 'has candidate',
      data: { relation: 'HAS_CANDIDATE', provenance: 'Stored relation' },
    });
  });
});

import type { GraphView } from '@immunograph/shared';
import { MarkerType, type Edge, type Node } from '@xyflow/react';

export type GraphNodeData = GraphView['nodes'][number]['data'] & { nodeType: string };
export type ScientificNode = Node<GraphNodeData, 'scientific'>;

export function createGraphElements(graph: GraphView): {
  nodes: ScientificNode[];
  edges: Edge[];
} {
  return {
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: 'scientific',
      position: node.position,
      data: { ...node.data, nodeType: node.type },
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      label: edge.label ?? edge.relation.replaceAll('_', ' ').toLowerCase(),
      markerEnd: { type: MarkerType.ArrowClosed },
      data: { relation: edge.relation, provenance: edge.provenance },
      style: { strokeWidth: 1.5 },
      labelStyle: { fontSize: 11, fontWeight: 600 },
    })),
  };
}

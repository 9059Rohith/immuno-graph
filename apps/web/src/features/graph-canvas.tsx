import type { GraphView } from '@immunograph/shared';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { Network } from 'lucide-react';

import { SourceStatusBadge, type SourceStatus } from '@/components/source-status-badge';
import { Badge } from '@/components/ui/badge';

import { createGraphElements, type GraphNodeData, type ScientificNode } from './graph-elements';

function ScientificGraphNode({ data }: NodeProps<ScientificNode>) {
  return (
    <div
      aria-label={`${data.nodeType}: ${data.label}${data.status ? `, ${data.status}` : ''}`}
      className="w-[230px] rounded-lg border-2 border-border bg-card text-card-foreground shadow-sm"
      role="group"
    >
      <Handle
        className="!size-3 !border-2 !border-card !bg-primary"
        position={Position.Left}
        type="target"
      />
      <div className="border-b bg-muted/45 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {data.nodeType.replaceAll('_', ' ')}
          </span>
          {data.status ? <Badge variant="outline">{data.status}</Badge> : null}
        </div>
        <div className="mt-1 break-words text-sm leading-tight font-semibold">{data.label}</div>
        {data.subtitle ? (
          <div className="mt-1 break-words text-xs text-muted-foreground">{data.subtitle}</div>
        ) : null}
      </div>
      {data.sourceStatus || data.detailLines.length > 0 ? (
        <div className="space-y-2 px-3 py-2">
          {data.sourceStatus ? (
            <SourceStatusBadge status={data.sourceStatus as SourceStatus} />
          ) : null}
          {data.detailLines.slice(0, 2).map((line) => (
            <div className="break-words text-[11px] leading-snug text-muted-foreground" key={line}>
              {line}
            </div>
          ))}
        </div>
      ) : null}
      <Handle
        className="!size-3 !border-2 !border-card !bg-primary"
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

const nodeTypes = { scientific: ScientificGraphNode };

const minimapColor = (node: Node) => {
  const data = node.data as GraphNodeData;
  if (data.sourceStatus === 'FIXTURE' || data.sourceStatus === 'SYNTHETIC') {
    return 'var(--fixture-foreground)';
  }
  if (data.status === 'FAILED' || data.status === 'REJECTED') return 'var(--destructive)';
  if (data.status === 'SUCCEEDED' || data.status === 'RECOMMENDED') return 'var(--primary)';
  return 'var(--muted-foreground)';
};

export function GraphCanvas({ graph, label }: { graph: GraphView; label: string }) {
  const { nodes, edges } = createGraphElements(graph);
  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-80 items-center justify-center bg-muted/20 p-6 text-center">
        <div className="max-w-sm">
          <Network aria-hidden="true" className="mx-auto size-9 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">No graph records yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start an approved analysis run to persist the nodes and relationships for this view.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div aria-label={label} className="h-full min-h-80 w-full" role="region">
      <ReactFlow
        defaultEdgeOptions={{ type: 'smoothstep' }}
        edges={edges}
        edgesFocusable
        fitView
        fitViewOptions={{ padding: 0.14, minZoom: 0.28, maxZoom: 1 }}
        maxZoom={1.75}
        minZoom={0.2}
        nodeTypes={nodeTypes}
        nodes={nodes}
        nodesConnectable={false}
        nodesDraggable={false}
        nodesFocusable
        panOnScroll
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          className="!border !bg-card"
          maskColor="color-mix(in oklch, var(--background) 72%, transparent)"
          nodeColor={minimapColor}
          pannable
          zoomable
        />
        <Panel
          className="rounded-md border bg-card/95 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm"
          position="top-right"
        >
          {nodes.length} nodes · {edges.length} relations
        </Panel>
      </ReactFlow>
    </div>
  );
}

interface WorkflowMetricsProps {
  nodes: number;
  connections: number;
}

// The two "Structure / Connections" stat boxes inside a workflow card.
export function WorkflowMetrics({ nodes, connections }: WorkflowMetricsProps) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Structure
        </p>
        <p className="mt-1 font-semibold text-on-surface">
          {nodes} node{nodes === 1 ? "" : "s"}
        </p>
      </div>
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          Connections
        </p>
        <p className="mt-1 font-semibold text-on-surface">
          {connections} link{connections === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

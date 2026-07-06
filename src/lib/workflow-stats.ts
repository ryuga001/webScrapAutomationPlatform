import type { Workflow } from "@/lib/workflow";

// Pure aggregate metrics across a set of workflows.
export interface WorkflowStats {
  total: number;
  nodes: number;
  connections: number;
  /** e.g. "80%", or "—" when nothing has run yet. */
  successRate: string;
}

export function computeWorkflowStats(workflows: Workflow[]): WorkflowStats {
  const ran = workflows.filter((w) => w.lastRun);
  const passed = ran.filter((w) => w.lastRun!.ok).length;
  return {
    total: workflows.length,
    nodes: workflows.reduce((sum, w) => sum + w.nodes.length, 0),
    connections: workflows.reduce((sum, w) => sum + w.edges.length, 0),
    successRate: ran.length ? `${Math.round((passed / ran.length) * 100)}%` : "—",
  };
}

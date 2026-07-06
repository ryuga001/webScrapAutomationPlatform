import type { Workflow } from "@/lib/workflow";

// Pure derivation of a workflow's display status from its last run. No React,
// no side effects — trivially unit-testable and reusable.
export interface WorkflowStatus {
  label: "Draft" | "Passed" | "Failed";
  /** Tailwind classes for the status dot. */
  dot: string;
  /** Tailwind classes for the badge background/text. */
  cls: string;
}

export function getWorkflowStatus(
  lastRun: Workflow["lastRun"],
): WorkflowStatus {
  if (!lastRun) {
    return { label: "Draft", dot: "bg-slate-400", cls: "bg-slate-100 text-slate-700" };
  }
  return lastRun.ok
    ? { label: "Passed", dot: "bg-emerald-500", cls: "bg-emerald-100 text-emerald-800" }
    : { label: "Failed", dot: "bg-rose-500", cls: "bg-rose-100 text-rose-800" };
}

import type { Workflow } from "@/lib/workflow";
import { getWorkflowStatus } from "@/lib/workflow-status";

interface StatusBadgeProps {
  lastRun: Workflow["lastRun"];
}

// Renders Draft / Passed / Failed derived purely from the workflow's last run.
export function StatusBadge({ lastRun }: StatusBadgeProps) {
  const status = getWorkflowStatus(lastRun);
  return (
    <span
      className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
    >
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`} />
      {status.label}
    </span>
  );
}

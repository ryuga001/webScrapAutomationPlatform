import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Workflow } from "@/lib/workflow";

interface WorkflowFooterProps {
  workflow: Workflow;
  onDelete: () => void;
}

// Card footer: last-updated info + Delete/Open actions.
export function WorkflowFooter({ workflow, onDelete }: WorkflowFooterProps) {
  const failed = workflow.lastRun && !workflow.lastRun.ok;
  return (
    <div className="mt-auto flex items-center justify-between gap-3 border-t border-outline-variant/40 pt-5">
      <div className="flex items-center gap-1 text-sm text-on-surface-variant">
        {failed && <AlertTriangle size={14} className="text-error" />}
        <span>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onDelete}
          className="rounded-lg px-3 py-2 text-sm font-bold text-error transition-colors hover:bg-error/10"
        >
          Delete
        </button>
        <Link
          href={`/workflows/${workflow.id}`}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-on-primary shadow-sm transition-all hover:brightness-110 active:scale-95"
        >
          Open
        </Link>
      </div>
    </div>
  );
}

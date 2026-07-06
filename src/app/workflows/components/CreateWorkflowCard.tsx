import Link from "next/link";
import { Plus } from "lucide-react";

// The dashed "add" tile that always trails the workflow grid.
export function CreateWorkflowCard() {
  return (
    <Link
      href="/workflows/new"
      className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant bg-surface-container-low/50 p-6 text-center transition-all duration-300 hover:bg-surface-container-low"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Plus size={30} />
      </div>
      <h4 className="font-display text-lg font-bold text-on-surface-variant">
        Create New Workflow
      </h4>
      <p className="mt-2 max-w-[220px] text-sm text-on-surface-variant">
        Start building a new automation from scratch.
      </p>
    </Link>
  );
}

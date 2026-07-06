import type { Workflow } from "@/lib/workflow";
import { WorkflowCard } from "./WorkflowCard";
import { CreateWorkflowCard } from "./CreateWorkflowCard";

interface WorkflowGridProps {
  workflows: Workflow[];
  onDelete: (workflow: Workflow) => void;
}

// Responsive grid of workflow cards, always trailed by the create tile.
export function WorkflowGrid({ workflows, onDelete }: WorkflowGridProps) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {workflows.map((wf) => (
        <WorkflowCard key={wf.id} workflow={wf} onDelete={onDelete} />
      ))}
      <CreateWorkflowCard />
    </div>
  );
}

import type { ComponentType } from "react";
import {
  Workflow as WorkflowIcon,
  Boxes,
  CheckCircle2,
  Share2,
} from "lucide-react";
import type { WorkflowStats } from "@/lib/workflow-stats";

type IconType = ComponentType<{ size?: number; className?: string }>;

function StatCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: string;
  icon: IconType;
  tint: string;
}) {
  return (
    <div className="flex items-start justify-between rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-sm">
      <div>
        <p className="text-sm text-on-surface-variant">{label}</p>
        <p className="mt-1 font-display text-2xl font-bold text-on-surface">{value}</p>
      </div>
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tint}`}>
        <Icon size={18} />
      </span>
    </div>
  );
}

interface StatsCardsProps {
  stats: WorkflowStats;
}

// Aggregate metrics row. Built and ready; not currently mounted in the screen.
export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="Workflows"
        value={String(stats.total)}
        icon={WorkflowIcon}
        tint="bg-primary-container text-on-primary-container"
      />
      <StatCard
        label="Total Nodes"
        value={String(stats.nodes)}
        icon={Boxes}
        tint="bg-indigo-100 text-indigo-700"
      />
      <StatCard
        label="Success Rate"
        value={stats.successRate}
        icon={CheckCircle2}
        tint="bg-emerald-100 text-emerald-700"
      />
      <StatCard
        label="Connections"
        value={String(stats.connections)}
        icon={Share2}
        tint="bg-amber-100 text-amber-700"
      />
    </div>
  );
}

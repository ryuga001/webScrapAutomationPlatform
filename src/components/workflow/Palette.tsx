"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { nodesByCategory } from "@/lib/nodes";
import { CAT_CLASSES } from "@/lib/node-ui";
import { NodeIcon } from "./NodeIcon";

export function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => nodesByCategory(), []);
  const q = query.trim().toLowerCase();

  return (
    <aside className="z-40 flex h-full w-[280px] flex-col border-r border-outline-variant bg-surface-container">
      <div className="border-b border-outline-variant p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-on-surface-variant">
            Node Palette
          </span>
          <Search size={16} className="text-on-surface-variant" />
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes…"
          className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-1.5 text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {groups.map(({ category, nodes }) => {
          const cat = CAT_CLASSES[category.key];
          const filtered = q
            ? nodes.filter(
                (n) =>
                  n.label.toLowerCase().includes(q) ||
                  n.description.toLowerCase().includes(q),
              )
            : nodes;
          if (filtered.length === 0) return null;
          return (
            <details key={category.key} open className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg p-2 hover:bg-surface-bright">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${cat.dot}`} />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-on-surface">
                    {category.label}
                  </span>
                </div>
                <span className="text-xs text-on-surface-variant">
                  {filtered.length}
                </span>
              </summary>
              <div className="mt-1 space-y-1 pl-2">
                {filtered.map((n) => (
                  <button
                    key={n.type}
                    onClick={() => onAdd(n.type)}
                    title={n.description}
                    className={`flex w-full items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-low p-2 text-left transition-colors ${cat.paletteHover}`}
                  >
                    <NodeIcon name={n.icon} className={cat.text} size={18} />
                    <span className="text-sm text-on-surface">{n.label}</span>
                  </button>
                ))}
              </div>
            </details>
          );
        })}
      </div>
    </aside>
  );
}

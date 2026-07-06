"use client";

import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { X } from "lucide-react";
import { getNodeType } from "@/lib/nodes";
import { CAT_CLASSES } from "@/lib/node-ui";
import { nodeSummary } from "@/lib/node-format";
import { NodeIcon } from "./NodeIcon";

export interface WebbotNodeData extends Record<string, unknown> {
  nodeType: string;
  config: Record<string, unknown>;
}

export function NodeCard({ id, data, selected }: NodeProps) {
  const d = data as WebbotNodeData;
  const def = getNodeType(d.nodeType);
  const { deleteElements } = useReactFlow();
  if (!def) return null;
  const cat = CAT_CLASSES[def.category];
  const summary = nodeSummary(d.nodeType, d.config);

  return (
    <div
      className={`group relative w-[210px] min-h-[62px] max-h-[200px] min-w-[180px] max-w-[240px] rounded-2xl border border-l-4 border-outline-variant ${cat.leftBar} bg-surface-container-lowest p-3 shadow-lg transition-all ${
        selected ? `ring-2 ${cat.ring}` : ""
      }`}
    >
      {def.inputs > 0 && (
        <Handle type="target" position={Position.Left} style={{ background: "#94a3b8" }} />
      )}

      {/* Delete button — appears on hover or when the node is selected */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          deleteElements({ nodes: [{ id }] });
        }}
        title="Delete node"
        className={`nodrag absolute -right-2 -top-2 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant shadow transition-opacity hover:border-rose-400 hover:text-rose-600 ${
          selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <X size={14} strokeWidth={2.5} />
      </button>

      <div className="flex items-center gap-2">
        <NodeIcon name={def.icon} className={cat.text} size={20} />
        <span className="font-display text-[15px] font-semibold leading-tight text-on-surface">
          {def.label}
        </span>
      </div>
      {summary && (
        <p className="mt-1 truncate text-xs text-on-surface-variant" title={summary}>
          {summary}
        </p>
      )}

      {def.outputs.length <= 1 ? (
        def.outputs.length === 1 && (
          <Handle
            type="source"
            position={Position.Right}
            id={def.outputs[0].id}
            style={{ background: "#94a3b8" }}
          />
        )
      ) : (
        <div className="mt-2 flex flex-col items-end gap-1">
          {def.outputs.map((port, i) => (
            <div key={port.id} className="relative flex items-center gap-1 pr-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant">
                {port.label ?? port.id}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={port.id}
                style={{
                  position: "absolute",
                  right: -14,
                  top: "50%",
                  background: i === 0 ? "#10b981" : "#f43f5e",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

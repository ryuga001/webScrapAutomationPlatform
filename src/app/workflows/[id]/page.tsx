"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronRight } from "lucide-react";
import { Palette } from "@/components/workflow/Palette";
import { NodeCard, type WebbotNodeData } from "@/components/workflow/NodeCard";
import { DeletableEdge } from "@/components/workflow/DeletableEdge";
import { ConfigModal } from "@/components/workflow/ConfigModal";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/RequireAuth";
import { Logo } from "@/components/Logo";
import { getNodeType } from "@/lib/nodes";
import { defaultConfig } from "@/lib/node-format";

type ModalState =
  | { mode: "add"; nodeType: string; config: Record<string, unknown> }
  | {
      mode: "edit";
      nodeId: string;
      nodeType: string;
      config: Record<string, unknown>;
    };

const EDGE_OPTIONS = {
  type: "deletable",
  style: { stroke: "#22d3ee", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#22d3ee" },
};

let idSeq = 1;
const newNodeId = () => `n${Date.now()}_${idSeq++}`;

function Editor() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const isNew = id === "new";

  const [name, setName] = useState("Untitled workflow");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const rf = useReactFlow();
  const { authFetch } = useAuth();

  const nodeTypes = useMemo(() => ({ webbot: NodeCard }), []);
  const edgeTypes = useMemo(() => ({ deletable: DeletableEdge }), []);
  // Tracks whether an in-progress edge reconnect landed on a valid handle.
  const reconnectOk = useRef(true);

  // Load an existing workflow, or seed a blank one with a Start node.
  useEffect(() => {
    if (isNew) {
      setNodes([
        {
          id: newNodeId(),
          type: "webbot",
          position: { x: 80, y: 120 },
          data: { nodeType: "start", config: {} } satisfies WebbotNodeData,
        },
      ]);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await authFetch(`/api/workflows/${id}`);
      if (!res.ok) {
        if (!cancelled) {
          setLoading(false);
          setToast("Workflow not found");
        }
        return;
      }
      const { workflow } = await res.json();
      if (cancelled) return;
      setName(workflow.name);
      setNodes(
        workflow.nodes.map(
          (n: {
            id: string;
            type: string;
            position: { x: number; y: number };
            config: Record<string, unknown>;
          }) => ({
            id: n.id,
            type: "webbot",
            position: n.position,
            data: { nodeType: n.type, config: n.config } satisfies WebbotNodeData,
          }),
        ),
      );
      setEdges(
        workflow.edges.map(
          (e: {
            id: string;
            source: string;
            target: string;
            sourceHandle?: string | null;
            targetHandle?: string | null;
          }) => ({ ...e, ...EDGE_OPTIONS }),
        ),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, setNodes, setEdges, authFetch]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, ...EDGE_OPTIONS }, eds)),
    [setEdges],
  );

  // Drag an edge's endpoint off a handle to disconnect it. If it lands on
  // another handle we rewire it; if it's dropped in empty space we remove it.
  const onReconnectStart = useCallback(() => {
    reconnectOk.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectOk.current = true;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges],
  );

  const onReconnectEnd = useCallback(
    (_: unknown, edge: Edge) => {
      if (!reconnectOk.current) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
    },
    [setEdges],
  );

  const handleAdd = useCallback((type: string) => {
    const def = getNodeType(type);
    if (!def) return;
    setModal({ mode: "add", nodeType: type, config: defaultConfig(def) });
  }, []);

  const onNodeDoubleClick = useCallback((_: unknown, node: Node) => {
    const d = node.data as WebbotNodeData;
    setModal({
      mode: "edit",
      nodeId: node.id,
      nodeType: d.nodeType,
      config: d.config,
    });
  }, []);

  const handleModalSave = useCallback(
    (config: Record<string, unknown>) => {
      if (!modal) return;
      if (modal.mode === "edit") {
        setNodes((nds) =>
          nds.map((n) =>
            n.id === modal.nodeId
              ? { ...n, data: { ...(n.data as WebbotNodeData), config } }
              : n,
          ),
        );
      } else {
        setNodes((nds) => {
          const rightmost = nds.reduce(
            (acc, n) => (n.position.x > acc.x ? { x: n.position.x, y: n.position.y } : acc),
            { x: 0, y: 120 },
          );
          const pos = nds.length
            ? { x: rightmost.x + 260, y: rightmost.y }
            : { x: 80, y: 120 };
          return [
            ...nds,
            {
              id: newNodeId(),
              type: "webbot",
              position: pos,
              data: { nodeType: modal.nodeType, config } satisfies WebbotNodeData,
            },
          ];
        });
      }
      setModal(null);
    },
    [modal, setNodes],
  );

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        viewport: rf.getViewport(),
        nodes: nodes.map((n) => {
          const d = n.data as WebbotNodeData;
          return { id: n.id, type: d.nodeType, position: n.position, config: d.config };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
        })),
      };
      const res = await authFetch(isNew ? "/api/workflows" : `/api/workflows/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.error ?? "Save failed");
        return;
      }
      if (isNew) router.replace(`/workflows/${data.workflow.id}`);
      else flash("Saved");
    } finally {
      setSaving(false);
    }
  }, [name, nodes, edges, rf, isNew, id, router, authFetch]);

  return (
    <div className="flex h-screen flex-col bg-surface">
      <header className="z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-6">
        <div className="flex items-center gap-4">
          <Link href="/workflows" className="flex items-center gap-2">
            <Logo size={28} className="rounded-md" />
            <span className="font-display text-xl font-bold tracking-tight text-primary">
              WebBot
            </span>
          </Link>
          <div className="h-6 w-px bg-outline-variant" />
          <nav className="flex items-center gap-2 text-sm">
            <Link href="/workflows" className="text-on-surface-variant hover:text-primary">
              Workflows
            </Link>
            <ChevronRight size={16} className="text-on-surface-variant" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-72 rounded bg-transparent px-2 py-1 font-semibold text-on-surface outline-none hover:bg-surface-container focus:bg-surface-container"
            />
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-on-surface-variant sm:inline">
            Run this workflow from the WebBot browser extension
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-primary hover:opacity-90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Palette onAdd={handleAdd} />

        <div className="relative flex-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-on-surface-variant">
              Loading…
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onReconnectStart={onReconnectStart}
              onReconnect={onReconnect}
              onReconnectEnd={onReconnectEnd}
              onNodeDoubleClick={onNodeDoubleClick}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={EDGE_OPTIONS}
              fitView
              fitViewOptions={{ maxZoom: 1, padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={28} size={1.4} color="#c3cbe6" />
              <Controls className="!rounded-xl !border !border-outline-variant !bg-surface-container !shadow-lg" />
            </ReactFlow>
          )}

          {!loading && nodes.length <= 1 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="rounded-full bg-surface-container px-4 py-2 text-sm text-on-surface-variant shadow">
                Click a node in the palette to add it →
              </p>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <ConfigModal
          nodeType={modal.nodeType}
          initialConfig={modal.config}
          isNew={modal.mode === "add"}
          onSave={handleModalSave}
          onClose={() => setModal(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-on-surface px-4 py-2 text-sm font-medium text-surface shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default function WorkflowEditorPage() {
  return (
    <RequireAuth>
      <ReactFlowProvider>
        <Editor />
      </ReactFlowProvider>
    </RequireAuth>
  );
}

import { randomUUID } from "node:crypto";
import { getNodeType } from "./nodes";
import type { WorkflowEdge, WorkflowInput, WorkflowNode } from "./workflow";

export class ValidationError extends Error {}

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parseNodes(raw: unknown): WorkflowNode[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError("nodes must be an array");
  return raw.map((item, i) => {
    if (typeof item !== "object" || item === null)
      throw new ValidationError(`Node ${i + 1} is invalid`);
    const n = item as Record<string, unknown>;
    const type = asString(n.type);
    if (!getNodeType(type))
      throw new ValidationError(`Node ${i + 1} has unknown type "${type}"`);
    const pos = (n.position ?? {}) as Record<string, unknown>;
    return {
      id: asString(n.id) || randomUUID(),
      type,
      position: {
        x: Number(pos.x) || 0,
        y: Number(pos.y) || 0,
      },
      config:
        typeof n.config === "object" && n.config !== null
          ? (n.config as Record<string, unknown>)
          : {},
    } satisfies WorkflowNode;
  });
}

function parseEdges(raw: unknown): WorkflowEdge[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError("edges must be an array");
  return raw.map((item, i) => {
    if (typeof item !== "object" || item === null)
      throw new ValidationError(`Edge ${i + 1} is invalid`);
    const e = item as Record<string, unknown>;
    const source = asString(e.source);
    const target = asString(e.target);
    if (!source || !target)
      throw new ValidationError(`Edge ${i + 1} must have source and target`);
    return {
      id: asString(e.id) || randomUUID(),
      source,
      target,
      sourceHandle: e.sourceHandle == null ? null : asString(e.sourceHandle),
      targetHandle: e.targetHandle == null ? null : asString(e.targetHandle),
    } satisfies WorkflowEdge;
  });
}

export function parseWorkflowInput(body: unknown): WorkflowInput {
  if (typeof body !== "object" || body === null)
    throw new ValidationError("Request body must be an object");
  const b = body as Record<string, unknown>;
  const name = asString(b.name);
  if (!name) throw new ValidationError("Workflow name is required");

  const viewport =
    typeof b.viewport === "object" && b.viewport !== null
      ? (() => {
          const v = b.viewport as Record<string, unknown>;
          return {
            x: Number(v.x) || 0,
            y: Number(v.y) || 0,
            zoom: Number(v.zoom) || 1,
          };
        })()
      : undefined;

  return {
    name,
    nodes: parseNodes(b.nodes),
    edges: parseEdges(b.edges),
    viewport,
  };
}

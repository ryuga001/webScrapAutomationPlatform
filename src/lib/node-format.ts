import { getNodeType } from "./nodes";
import type { LocatorValue, NodeTypeDef } from "./nodes";
import { LOCATOR_TYPES } from "./types";

/** Format a locator value into a short readable label. */
export function formatLocator(v: unknown): string {
  if (!v || typeof v !== "object") return "";
  const l = v as LocatorValue;
  if (!l.selector) return "";
  if (l.by === "role") return `${l.role || "element"} “${l.selector}”`;
  const label = LOCATOR_TYPES.find((t) => t.value === l.by)?.label ?? l.by;
  return `${label}: “${l.selector}”`;
}

/** Turn a node's raw config into display strings for summaries. */
export function configDisplay(
  def: NodeTypeDef,
  config: Record<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of def.fields) {
    const v = config[f.name];
    if (f.kind === "locator") out[f.name] = formatLocator(v);
    else if (f.kind === "mappings")
      out[f.name] = Array.isArray(v) ? `${v.length} column(s)` : "";
    else out[f.name] = v == null ? "" : String(v);
  }
  return out;
}

/** One-line summary for a node card. */
export function nodeSummary(
  type: string,
  config: Record<string, unknown>,
): string {
  const def = getNodeType(type);
  if (!def) return type;
  const display = configDisplay(def, config);
  return def.summarize ? def.summarize(display) : def.label;
}

/** Build a config object pre-filled with a node type's field defaults. */
export function defaultConfig(def: NodeTypeDef): Record<string, unknown> {
  const c: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.kind === "locator") c[f.name] = { by: "text", selector: "" };
    else if (f.kind === "mappings") c[f.name] = [];
    else if (f.default != null) c[f.name] = f.default;
  }
  return c;
}

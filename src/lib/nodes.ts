// The node registry: the single source of truth for every atomic node type.
// It drives (a) the palette, (b) the add/edit config modal (via `fields`), and
// (c) execution (the engine looks a node up by `type`). This is how a node
// "knows what to do" — its behaviour is fully described by its type + config.

import type { LocatorType } from "./types";

/** Value stored for a "locator" config field. */
export interface LocatorValue {
  by: LocatorType;
  role?: string;
  selector: string;
}

/** One row for a "mappings" config field (e.g. Append Row columns). */
export interface Mapping {
  key: string;
  value: string;
}

export type NodeCategory =
  | "core"
  | "navigation"
  | "interaction"
  | "extract"
  | "logic"
  | "data"
  | "ai";

export interface CategoryMeta {
  key: NodeCategory;
  label: string;
  /** Tailwind text/border color class stem, e.g. "cyan-400". */
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: "core", label: "Core", color: "slate-400" },
  { key: "navigation", label: "Navigation", color: "cyan-400" },
  { key: "interaction", label: "Interaction", color: "blue-400" },
  { key: "extract", label: "Extract", color: "emerald-400" },
  { key: "logic", label: "Logic / Flow", color: "violet-400" },
  { key: "data", label: "Data / Output", color: "amber-400" },
  { key: "ai", label: "AI", color: "fuchsia-400" },
];

/** Kinds of config inputs the modal knows how to render. */
export type FieldKind =
  | "text"
  | "url"
  | "number"
  | "textarea"
  | "select"
  | "locator" // Find-by strategy + optional role + identifier
  | "variable" // a variable name to read/write
  | "mappings"; // list of column -> value pairs (for Append Row)

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDef {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: FieldOption[];
  default?: string;
}

export interface OutputPort {
  id: string;
  label?: string;
}

export interface NodeTypeDef {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  /** Lucide icon key (see src/components/workflow/NodeIcon.tsx). */
  icon: string;
  /** Number of input ports (0 for Start). */
  inputs: number;
  /** Output ports; branch nodes have more than one. */
  outputs: OutputPort[];
  /** Config fields — rendered in the add/edit modal, in order. */
  fields: FieldDef[];
  /** Build the one-line summary shown on the node card. */
  summarize?: (config: Record<string, string>) => string;
}

const LOCATOR_FIELD: FieldDef = {
  name: "locator",
  label: "Target element",
  kind: "locator",
  required: true,
  help: "How to find the element on the page.",
};

const one = [{ id: "out" }];

export const NODE_TYPES: NodeTypeDef[] = [
  // ---- Core ----
  {
    type: "start",
    category: "core",
    label: "Start",
    description: "The entry point of the workflow.",
    icon: "play",
    inputs: 0,
    outputs: one,
    fields: [],
    summarize: () => "Entry point",
  },
  {
    type: "end",
    category: "core",
    label: "End",
    description: "Marks the end of the workflow.",
    icon: "stop",
    inputs: 1,
    outputs: [],
    fields: [],
    summarize: () => "Finish",
  },
  {
    type: "setVariable",
    category: "core",
    label: "Set Variable",
    description: "Store a value in a variable for later steps.",
    icon: "variable",
    inputs: 1,
    outputs: one,
    fields: [
      { name: "name", label: "Variable name", kind: "text", required: true, placeholder: "e.g. query" },
      { name: "value", label: "Value", kind: "text", placeholder: "Static value or {{expression}}" },
    ],
    summarize: (c) => (c.name ? `${c.name} = ${c.value ?? ""}` : "Set variable"),
  },
  {
    type: "note",
    category: "core",
    label: "Note",
    description: "A comment. Does nothing when run.",
    icon: "note",
    inputs: 1,
    outputs: one,
    fields: [{ name: "text", label: "Note", kind: "textarea", placeholder: "Anything worth remembering…" }],
    summarize: (c) => c.text || "Note",
  },

  // ---- Navigation ----
  {
    type: "goto",
    category: "navigation",
    label: "Go to URL",
    description: "Navigate the browser to a URL.",
    icon: "link",
    inputs: 1,
    outputs: one,
    fields: [
      { name: "url", label: "URL", kind: "url", required: true, placeholder: "https://example.com" },
    ],
    summarize: (c) => c.url || "Go to URL",
  },
  {
    type: "click",
    category: "navigation",
    label: "Click",
    description: "Click an element on the page.",
    icon: "click",
    inputs: 1,
    outputs: one,
    fields: [LOCATOR_FIELD],
    summarize: (c) => `Click ${c.locator || "…"}`,
  },
  {
    type: "hover",
    category: "navigation",
    label: "Hover",
    description: "Move the pointer over an element.",
    icon: "hover",
    inputs: 1,
    outputs: one,
    fields: [LOCATOR_FIELD],
    summarize: (c) => `Hover ${c.locator || "…"}`,
  },
  {
    type: "scroll",
    category: "navigation",
    label: "Scroll",
    description: "Scroll the page (or to an element).",
    icon: "scroll",
    inputs: 1,
    outputs: one,
    fields: [
      {
        name: "direction",
        label: "Direction",
        kind: "select",
        default: "bottom",
        options: [
          { value: "bottom", label: "To bottom" },
          { value: "top", label: "To top" },
          { value: "element", label: "To element" },
        ],
      },
      { ...LOCATOR_FIELD, required: false, label: "Element (if scrolling to element)" },
    ],
    summarize: (c) => `Scroll ${c.direction || "bottom"}`,
  },
  {
    type: "wait",
    category: "navigation",
    label: "Wait",
    description: "Pause for a fixed number of milliseconds.",
    icon: "clock",
    inputs: 1,
    outputs: one,
    fields: [{ name: "ms", label: "Milliseconds", kind: "number", default: "1000", required: true }],
    summarize: (c) => `Wait ${c.ms || "0"}ms`,
  },
  {
    type: "waitForElement",
    category: "navigation",
    label: "Wait for Element",
    description: "Wait until an element becomes visible.",
    icon: "eye",
    inputs: 1,
    outputs: one,
    fields: [LOCATOR_FIELD],
    summarize: (c) => `Wait for ${c.locator || "…"}`,
  },
  {
    type: "goBack",
    category: "navigation",
    label: "Go Back",
    description: "Navigate back in browser history.",
    icon: "back",
    inputs: 1,
    outputs: one,
    fields: [],
    summarize: () => "Go back",
  },

  // ---- Interaction ----
  {
    type: "fill",
    category: "interaction",
    label: "Fill",
    description: "Set the value of an input field.",
    icon: "input",
    inputs: 1,
    outputs: one,
    fields: [
      LOCATOR_FIELD,
      { name: "value", label: "Value", kind: "text", required: true, placeholder: "Text to enter" },
    ],
    summarize: (c) => `Fill ${c.locator || "…"} = “${c.value ?? ""}”`,
  },
  {
    type: "type",
    category: "interaction",
    label: "Type",
    description: "Type text character by character.",
    icon: "keyboard",
    inputs: 1,
    outputs: one,
    fields: [
      LOCATOR_FIELD,
      { name: "value", label: "Text", kind: "text", required: true, placeholder: "Text to type" },
    ],
    summarize: (c) => `Type “${c.value ?? ""}”`,
  },
  {
    type: "pressKey",
    category: "interaction",
    label: "Press Key",
    description: "Press a keyboard key (e.g. Enter).",
    icon: "enter",
    inputs: 1,
    outputs: one,
    fields: [
      { name: "key", label: "Key", kind: "text", required: true, placeholder: "e.g. Enter, Tab, Escape" },
      { ...LOCATOR_FIELD, required: false, label: "Focus element (optional)" },
    ],
    summarize: (c) => `Press ${c.key || "…"}`,
  },
  {
    type: "selectOption",
    category: "interaction",
    label: "Select Option",
    description: "Choose an option in a <select> dropdown.",
    icon: "dropdown",
    inputs: 1,
    outputs: one,
    fields: [
      LOCATOR_FIELD,
      { name: "value", label: "Option value / label", kind: "text", required: true },
    ],
    summarize: (c) => `Select “${c.value ?? ""}”`,
  },

  // ---- Extract ----
  {
    type: "extractText",
    category: "extract",
    label: "Extract Text",
    description: "Read the visible text of an element into a variable.",
    icon: "scan-text",
    inputs: 1,
    outputs: one,
    fields: [
      LOCATOR_FIELD,
      { name: "output", label: "Save as variable", kind: "variable", required: true, placeholder: "e.g. name" },
    ],
    summarize: (c) => `Text → ${c.output || "var"}`,
  },
  {
    type: "extractAttribute",
    category: "extract",
    label: "Extract Attribute",
    description: "Read an element attribute (e.g. href) into a variable.",
    icon: "link",
    inputs: 1,
    outputs: one,
    fields: [
      LOCATOR_FIELD,
      { name: "attribute", label: "Attribute", kind: "text", required: true, default: "href", placeholder: "href" },
      { name: "output", label: "Save as variable", kind: "variable", required: true, placeholder: "e.g. profileLink" },
    ],
    summarize: (c) => `${c.attribute || "attr"} → ${c.output || "var"}`,
  },
  {
    type: "screenshot",
    category: "extract",
    label: "Screenshot",
    description: "Capture a screenshot of the page.",
    icon: "camera",
    inputs: 1,
    outputs: one,
    fields: [],
    summarize: () => "Screenshot",
  },

  // ---- Logic / Flow ----
  {
    type: "loop",
    category: "logic",
    label: "Loop / For Each",
    description: "Repeat the connected body once per matching element.",
    icon: "repeat",
    inputs: 1,
    outputs: [
      { id: "loop", label: "each" },
      { id: "done", label: "done" },
    ],
    fields: [
      { ...LOCATOR_FIELD, label: "Items to loop over", help: "Locator matching the list of elements." },
      { name: "itemVar", label: "Item variable", kind: "variable", default: "item", placeholder: "item" },
      { name: "limit", label: "Max iterations (optional)", kind: "number", placeholder: "e.g. 50" },
    ],
    summarize: (c) => `For each ${c.locator || "item"}`,
  },
  {
    type: "if",
    category: "logic",
    label: "If / Condition",
    description: "Branch based on a condition.",
    icon: "branch",
    inputs: 1,
    outputs: [
      { id: "true", label: "true" },
      { id: "false", label: "false" },
    ],
    fields: [
      { name: "left", label: "Value / variable", kind: "text", required: true, placeholder: "{{company}}" },
      {
        name: "op",
        label: "Condition",
        kind: "select",
        default: "notEmpty",
        options: [
          { value: "notEmpty", label: "is not empty" },
          { value: "empty", label: "is empty" },
          { value: "equals", label: "equals" },
          { value: "contains", label: "contains" },
          { value: "exists", label: "element exists (locator)" },
        ],
      },
      { name: "right", label: "Compare to", kind: "text", placeholder: "value (for equals/contains)" },
    ],
    summarize: (c) => `If ${c.left || "…"} ${c.op || "notEmpty"}`,
  },
  {
    type: "delay",
    category: "logic",
    label: "Delay",
    description: "Wait for a number of milliseconds.",
    icon: "timer",
    inputs: 1,
    outputs: one,
    fields: [{ name: "ms", label: "Milliseconds", kind: "number", default: "1000", required: true }],
    summarize: (c) => `Delay ${c.ms || "0"}ms`,
  },

  // ---- Data / Output ----
  {
    type: "appendRow",
    category: "data",
    label: "Append Row",
    description: "Add a row to a dataset (later exported as CSV).",
    icon: "table",
    inputs: 1,
    outputs: one,
    fields: [
      { name: "dataset", label: "Dataset name", kind: "text", default: "results", required: true },
      {
        name: "columns",
        label: "Columns",
        kind: "mappings",
        help: "Column name → value or {{variable}}.",
      },
    ],
    summarize: (c) => `Append to ${c.dataset || "results"}`,
  },
  {
    type: "exportCsv",
    category: "data",
    label: "Export CSV",
    description: "Export a dataset to a downloadable CSV file.",
    icon: "download",
    inputs: 1,
    outputs: one,
    fields: [
      { name: "dataset", label: "Dataset name", kind: "text", default: "results", required: true },
      { name: "filename", label: "File name", kind: "text", default: "results.csv" },
    ],
    summarize: (c) => `Export ${c.dataset || "results"} → CSV`,
  },
  {
    type: "exportText",
    category: "data",
    label: "Save to Text File",
    description: "Write text (with variables) to a downloadable .txt file.",
    icon: "file-text",
    inputs: 1,
    outputs: one,
    fields: [
      {
        name: "content",
        label: "Text to write",
        kind: "textarea",
        required: true,
        placeholder: "{{name}} — {{company}} ({{profileLink}})",
        help: "Uses {{variables}}. Inside a loop, each pass adds a line (Append mode).",
      },
      {
        name: "mode",
        label: "When it runs again",
        kind: "select",
        default: "append",
        options: [
          { value: "append", label: "Add a new line" },
          { value: "overwrite", label: "Replace the file" },
        ],
      },
      { name: "filename", label: "File name", kind: "text", default: "output.txt" },
    ],
    summarize: (c) => `Save → ${c.filename || "output.txt"}`,
  },

  // ---- AI ----
  {
    type: "generateText",
    category: "ai",
    label: "Generate Text",
    description: "Use an AI model to generate or transform text.",
    icon: "sparkles",
    inputs: 1,
    outputs: one,
    fields: [
      { name: "prompt", label: "Prompt", kind: "textarea", required: true, placeholder: "Summarize {{profileText}} in one line" },
      { name: "output", label: "Save as variable", kind: "variable", required: true, placeholder: "e.g. summary" },
    ],
    summarize: (c) => `AI → ${c.output || "var"}`,
  },
];

export const NODE_TYPE_MAP: Record<string, NodeTypeDef> = Object.fromEntries(
  NODE_TYPES.map((n) => [n.type, n]),
);

export function getNodeType(type: string): NodeTypeDef | undefined {
  return NODE_TYPE_MAP[type];
}

export function nodesByCategory(): { category: CategoryMeta; nodes: NodeTypeDef[] }[] {
  return CATEGORIES.map((category) => ({
    category,
    nodes: NODE_TYPES.filter((n) => n.category === category.key),
  }));
}

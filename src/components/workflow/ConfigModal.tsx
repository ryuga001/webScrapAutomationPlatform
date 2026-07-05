"use client";

import { useState } from "react";
import { X, MousePointerSquareDashed } from "lucide-react";
import { getNodeType } from "@/lib/nodes";
import type { FieldDef } from "@/lib/nodes";
import type { LocatorValue, Mapping } from "@/lib/nodes";
import { CAT_CLASSES } from "@/lib/node-ui";
import { LOCATOR_TYPES, ELEMENT_ROLES } from "@/lib/types";
import type { LocatorType } from "@/lib/types";
import { NodeIcon } from "./NodeIcon";

const INPUT =
  "w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none focus:border-primary";

export function ConfigModal({
  nodeType,
  initialConfig,
  isNew,
  defaultUrl,
  onSave,
  onClose,
}: {
  nodeType: string;
  initialConfig: Record<string, unknown>;
  isNew: boolean;
  defaultUrl?: string;
  onSave: (config: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const def = getNodeType(nodeType);
  const [config, setConfig] = useState<Record<string, unknown>>(initialConfig);
  if (!def) return null;
  const cat = CAT_CLASSES[def.category];
  const listMode = def.type === "loop";

  const set = (name: string, value: unknown) =>
    setConfig((c) => ({ ...c, [name]: value }));

  function handleSave() {
    // Enforce required fields.
    for (const f of def!.fields) {
      if (!f.required) continue;
      const v = config[f.name];
      const empty =
        v == null ||
        (f.kind === "locator" && !(v as LocatorValue)?.selector) ||
        (typeof v === "string" && v.trim() === "");
      if (empty) {
        alert(`"${f.label}" is required.`);
        return;
      }
    }
    onSave(config);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
      <div className="w-full max-w-[520px] overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className={`h-1.5 w-full ${cat.dot}`} />
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3">
            <NodeIcon name={def.icon} className={cat.text} size={24} />
            <div>
              <h2 className="font-display text-lg font-semibold text-on-surface">
                {def.label}
              </h2>
              <p className="text-xs text-on-surface-variant">{def.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-2">
          {def.fields.length === 0 && (
            <p className="rounded-lg bg-surface-container px-3 py-3 text-sm text-on-surface-variant">
              This node has no settings — it just runs.
            </p>
          )}
          {def.fields.map((f) => (
            <Field
              key={f.name}
              field={f}
              value={config[f.name]}
              onChange={(v) => set(f.name, v)}
              listMode={listMode}
              defaultUrl={defaultUrl}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-end gap-2 border-t border-outline-variant bg-surface-container-low px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-bright"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary hover:opacity-90"
          >
            {isNew ? "Add node" : "Save node"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  field,
  value,
  onChange,
  listMode,
  defaultUrl,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  listMode?: boolean;
  defaultUrl?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-on-surface">
        {field.label}
        {field.required && <span className="text-error"> *</span>}
      </label>
      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        listMode={listMode}
        defaultUrl={defaultUrl}
      />
      {field.help && (
        <p className="mt-1 text-xs text-on-surface-variant">{field.help}</p>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  listMode,
  defaultUrl,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  listMode?: boolean;
  defaultUrl?: string;
}) {
  switch (field.kind) {
    case "textarea":
      return (
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={INPUT}
        />
      );
    case "number":
      return (
        <input
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT}
        />
      );
    case "select":
      return (
        <select
          value={(value as string) ?? field.default ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        >
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "locator":
      return (
        <LocatorInput
          value={value as LocatorValue}
          onChange={onChange}
          listMode={listMode}
          defaultUrl={defaultUrl}
        />
      );
    case "mappings":
      return <MappingsInput value={value as Mapping[]} onChange={onChange} />;
    case "variable":
    case "text":
    case "url":
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={INPUT}
        />
      );
  }
}

function LocatorInput({
  value,
  onChange,
  listMode,
  defaultUrl,
}: {
  value: LocatorValue | undefined;
  onChange: (v: LocatorValue) => void;
  listMode?: boolean;
  defaultUrl?: string;
}) {
  const v: LocatorValue = value ?? { by: "text", selector: "" };
  const meta = LOCATOR_TYPES.find((t) => t.value === v.by);
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handlePick() {
    const url =
      defaultUrl && /^https?:\/\//.test(defaultUrl)
        ? defaultUrl
        : window.prompt(
            "Open which page to pick from? (add a 'Go to URL' node to skip this)",
            "https://",
          );
    if (!url) return;
    setPicking(true);
    setStatus(
      "Firefox is opening — browse to the page you want, then press “Pick” in the top bar and click the element.",
    );
    try {
      const res = await fetch("/api/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, mode: listMode ? "list" : "single" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? "Picking failed.");
        return;
      }
      onChange({ by: "css", selector: data.selector });
      setStatus(
        listMode
          ? `Matched ${data.count} item(s) with this selector.`
          : "Element selected.",
      );
    } catch {
      setStatus("Could not reach the picker.");
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-outline-variant bg-surface-container-low p-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-on-surface-variant">Find by</span>
          <select
            value={v.by}
            onChange={(e) => {
              const by = e.target.value as LocatorType;
              onChange({ ...v, by, role: by === "role" ? (v.role ?? "button") : undefined });
            }}
            className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-primary"
          >
            {LOCATOR_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        {v.by === "role" && (
          <select
            value={v.role ?? "button"}
            onChange={(e) => onChange({ ...v, role: e.target.value })}
            className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none focus:border-primary"
          >
            {ELEMENT_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={handlePick}
          disabled={picking}
          className="ml-auto flex items-center gap-1 rounded-md border border-primary px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-container/20 disabled:opacity-60"
          title="Open the page and click the element to auto-fill the selector"
        >
          <MousePointerSquareDashed size={14} />
          {picking ? "Picking…" : listMode ? "Pick list" : "Pick"}
        </button>
      </div>
      <input
        value={v.selector}
        onChange={(e) => onChange({ ...v, selector: e.target.value })}
        placeholder={meta?.placeholder ?? "Identifier"}
        className={INPUT}
      />
      {status ? (
        <p className="text-xs text-primary">{status}</p>
      ) : (
        meta && <p className="text-xs text-on-surface-variant">{meta.hint}</p>
      )}
    </div>
  );
}

function MappingsInput({
  value,
  onChange,
}: {
  value: Mapping[] | undefined;
  onChange: (v: Mapping[]) => void;
}) {
  const rows = value ?? [];
  const update = (i: number, patch: Partial<Mapping>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={row.key}
            onChange={(e) => update(i, { key: e.target.value })}
            placeholder="column"
            className={INPUT}
          />
          <span className="text-on-surface-variant">=</span>
          <input
            value={row.value}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder="value or {{variable}}"
            className={INPUT}
          />
          <button
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            className="text-on-surface-variant hover:text-error"
          >
            <X size={18} />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, { key: "", value: "" }])}
        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:border-primary"
      >
        + Add column
      </button>
    </div>
  );
}

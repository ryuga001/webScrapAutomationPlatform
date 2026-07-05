import { promises as fs } from "node:fs";
import path from "node:path";
import type { Locator, Page } from "playwright";
import { getNodeType } from "./nodes";
import type { LocatorValue, Mapping } from "./nodes";
import { ensureFirefoxProfile } from "./browser";
import { newCapture } from "./runner";
import type {
  NodeRunResult,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRunResult,
} from "./workflow";

const DEFAULT_TIMEOUT = 15_000;
const MAX_NODE_EXECUTIONS = 5000; // safety valve against runaway graphs

type RoleArg = Parameters<Page["getByRole"]>[0];

/** Replace {{var}} placeholders in a string with values from the context. */
function interp(s: string | undefined, vars: Record<string, string>): string {
  if (!s) return "";
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

/** Build a Playwright Locator from a stored LocatorValue, within a root scope. */
function locatorFrom(
  root: Page | Locator,
  loc: LocatorValue | undefined,
  vars: Record<string, string>,
): Locator {
  const sel = interp(loc?.selector, vars);
  switch (loc?.by) {
    case "text":
      return root.getByText(sel);
    case "role":
      return root.getByRole(
        (loc.role || "button") as RoleArg,
        sel ? { name: sel } : undefined,
      );
    case "label":
      return root.getByLabel(sel);
    case "placeholder":
      return root.getByPlaceholder(sel);
    case "testid":
      return root.getByTestId(sel);
    default:
      return root.locator(sel);
  }
}

function classify(
  err: unknown,
  isLocator: boolean,
): { errorType: string; message: string; detail: string } {
  const detail = err instanceof Error ? err.message : String(err);
  const secs = Math.round(DEFAULT_TIMEOUT / 1000);
  if (/strict mode violation|resolved to \d+ elements/i.test(detail)) {
    return {
      errorType: "ambiguous",
      message:
        "The identifier matched multiple elements — make it more specific.",
      detail,
    };
  }
  if (/net::|NS_ERROR|ERR_|Navigation|goto/i.test(detail)) {
    return {
      errorType: "navigation",
      message: `Couldn't open the page — check the URL is reachable. (${detail.split("\n")[0]})`,
      detail,
    };
  }
  if (/Timeout .* exceeded/i.test(detail)) {
    return {
      errorType: isLocator ? "not_found" : "timeout",
      message: isLocator
        ? `Couldn't find the element within ${secs}s — it may not exist, be hidden, or the identifier may be wrong.`
        : `Step timed out after ${secs}s.`,
      detail,
    };
  }
  return { errorType: "error", message: detail.split("\n")[0], detail };
}

interface Ctx {
  page: Page;
  vars: Record<string, string>;
  scope?: Locator; // current loop item element, if any
  datasets: Record<string, Record<string, string>[]>;
  csv: Record<string, string>;
  textBuf: Record<string, string>; // accumulated .txt content per file
  txt: Record<string, string>; // exported .txt URLs per file
  results: NodeRunResult[];
  nodeById: Map<string, WorkflowNode>;
  edges: WorkflowEdge[];
  captureDir?: string;
  urlPrefix?: string;
  seq: number;
  execCount: number;
  iteration?: number;
}

function edgeTarget(
  ctx: Ctx,
  nodeId: string,
  handle: string,
): string | undefined {
  const e = ctx.edges.find(
    (e) => e.source === nodeId && (e.sourceHandle ?? "out") === handle,
  );
  return e?.target;
}

async function capture(ctx: Ctx): Promise<string | undefined> {
  if (!ctx.captureDir || !ctx.urlPrefix) return undefined;
  try {
    const file = `node-${ctx.seq++}.jpg`;
    await ctx.page.screenshot({
      path: path.join(ctx.captureDir, file),
      type: "jpeg",
      quality: 55,
    });
    return `${ctx.urlPrefix}/${file}`;
  } catch {
    return undefined;
  }
}

function cfg(node: WorkflowNode): Record<string, unknown> {
  return node.config ?? {};
}

/**
 * Execute a single node. Returns the id of the output handle to follow next
 * ("out", "true"/"false" for If, "done" for Loop), or null to stop this branch.
 */
async function execNode(ctx: Ctx, node: WorkflowNode): Promise<string | null> {
  const def = getNodeType(node.type);
  if (!def) return "out";
  const c = cfg(node);
  const root = ctx.scope ?? ctx.page;
  const started = performance.now();
  let handle: string | null = "out";
  let ok = true;
  let error: { errorType: string; message: string; detail: string } | undefined;
  let isLocator = false;
  let warn: string | undefined; // non-fatal note surfaced on the node result

  try {
    switch (node.type) {
      case "start":
      case "note":
        break;
      case "end":
        handle = null;
        break;
      case "setVariable":
        ctx.vars[interp(c.name as string, ctx.vars)] = interp(c.value as string, ctx.vars);
        break;

      case "goto":
        await ctx.page.goto(interp(c.url as string, ctx.vars), {
          timeout: DEFAULT_TIMEOUT,
          waitUntil: "domcontentloaded",
        });
        break;
      case "goBack":
        await ctx.page.goBack({ timeout: DEFAULT_TIMEOUT });
        break;
      case "wait":
      case "delay":
        await ctx.page.waitForTimeout(Math.min(Number(c.ms) || 0, 60_000));
        break;
      case "scroll":
        if (c.direction === "top") await ctx.page.evaluate(() => window.scrollTo(0, 0));
        else if (c.direction === "element") {
          isLocator = true;
          await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
            .first()
            .scrollIntoViewIfNeeded({ timeout: DEFAULT_TIMEOUT });
        } else
          await ctx.page.evaluate(() =>
            window.scrollTo(0, document.body.scrollHeight),
          );
        break;

      case "click":
        isLocator = true;
        await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .click({ timeout: DEFAULT_TIMEOUT });
        break;
      case "hover":
        isLocator = true;
        await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .hover({ timeout: DEFAULT_TIMEOUT });
        break;
      case "waitForElement":
        isLocator = true;
        await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
        break;
      case "fill":
        isLocator = true;
        await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .fill(interp(c.value as string, ctx.vars), { timeout: DEFAULT_TIMEOUT });
        break;
      case "type":
        isLocator = true;
        await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .pressSequentially(interp(c.value as string, ctx.vars), {
            timeout: DEFAULT_TIMEOUT,
          });
        break;
      case "pressKey":
        if (c.locator && (c.locator as LocatorValue).selector) {
          isLocator = true;
          await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
            .first()
            .press(interp(c.key as string, ctx.vars), { timeout: DEFAULT_TIMEOUT });
        } else {
          await ctx.page.keyboard.press(interp(c.key as string, ctx.vars));
        }
        break;
      case "selectOption":
        isLocator = true;
        await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .selectOption(interp(c.value as string, ctx.vars), { timeout: DEFAULT_TIMEOUT });
        break;

      case "extractText": {
        isLocator = true;
        const outVar = (c.output as string) || "text";
        const text = await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .innerText({ timeout: DEFAULT_TIMEOUT });
        ctx.vars[outVar] = text.trim();
        if (!text.trim())
          warn = `Extracted empty text into “${outVar}” — the element was found but has no text.`;
        break;
      }
      case "extractAttribute": {
        isLocator = true;
        const outVar = (c.output as string) || "value";
        const attr = interp(c.attribute as string, ctx.vars) || "href";
        const val = await locatorFrom(root, c.locator as LocatorValue, ctx.vars)
          .first()
          .getAttribute(attr, { timeout: DEFAULT_TIMEOUT });
        ctx.vars[outVar] = val ?? "";
        if (val == null)
          warn = `Element has no “${attr}” attribute — “${outVar}” is empty.`;
        break;
      }
      case "screenshot":
        // captured below like every node
        break;

      case "if": {
        handle = evalCondition(ctx, c, root) ? "true" : "false";
        break;
      }
      case "loop": {
        await runLoop(ctx, node, c);
        handle = "done";
        break;
      }

      case "appendRow": {
        const ds = (c.dataset as string) || "results";
        const cols = (c.columns as Mapping[]) ?? [];
        const row: Record<string, string> = {};
        for (const m of cols) {
          if (m.key) row[m.key] = interp(m.value, ctx.vars);
        }
        (ctx.datasets[ds] ??= []).push(row);
        if (cols.length === 0)
          warn = "This Append Row has no columns configured.";
        else if (Object.values(row).every((v) => v === ""))
          warn =
            "All column values are empty — check the {{variable}} names match your Extract nodes.";
        break;
      }
      case "exportCsv": {
        const ds = (c.dataset as string) || "results";
        const rows = ctx.datasets[ds] ?? [];
        const url = await writeCsv(ctx, (c.filename as string) || `${ds}.csv`, rows);
        if (url) ctx.csv[ds] = url;
        if (rows.length === 0) {
          const known = Object.keys(ctx.datasets);
          warn =
            `No rows to export — dataset “${ds}” is empty. ` +
            `Add an “Append Row” node (with dataset “${ds}”) before Export CSV to collect data.` +
            (known.length ? ` Datasets that do have rows: ${known.join(", ")}.` : "");
        }
        break;
      }
      case "exportText": {
        const fname = (c.filename as string) || "output.txt";
        const content = interp(c.content as string, ctx.vars);
        if (c.mode === "overwrite") ctx.textBuf[fname] = content;
        else
          ctx.textBuf[fname] =
            (ctx.textBuf[fname] !== undefined ? ctx.textBuf[fname] + "\n" : "") +
            content;
        const url = await writeText(ctx, fname, ctx.textBuf[fname]);
        if (url) ctx.txt[fname] = url;
        if (!content.trim())
          warn = "Wrote empty text — check the {{variable}} names match your Extract nodes.";
        break;
      }

      case "generateText": {
        const out = (c.output as string) || "text";
        ctx.vars[out] = await generateText(interp(c.prompt as string, ctx.vars));
        break;
      }

      default:
        break;
    }
  } catch (err) {
    ok = false;
    error = classify(err, isLocator);
  }

  const result: NodeRunResult = {
    nodeId: node.id,
    type: node.type,
    label: def.label,
    ok,
    durationMs: Math.round(performance.now() - started),
    screenshot: await capture(ctx),
  };
  if (ctx.iteration !== undefined) result.iteration = ctx.iteration;
  if (error) {
    result.message = error.message;
    result.errorType = error.errorType;
    result.detail = error.detail;
  } else if (warn) {
    result.message = warn;
    result.errorType = "warning";
  }
  ctx.results.push(result);
  if (!ok) throw new EngineStop(); // stop the run on first failure
  return handle;
}

class EngineStop extends Error {}

function evalCondition(
  ctx: Ctx,
  c: Record<string, unknown>,
  root: Page | Locator,
): boolean {
  const left = interp(c.left as string, ctx.vars);
  const right = interp(c.right as string, ctx.vars);
  switch (c.op) {
    case "empty":
      return left.trim() === "";
    case "equals":
      return left === right;
    case "contains":
      return left.includes(right);
    case "exists":
      // best-effort: presence not awaited deeply; treated as notEmpty of left
      return !!(c.left && root);
    case "notEmpty":
    default:
      return left.trim() !== "";
  }
}

async function runLoop(
  ctx: Ctx,
  node: WorkflowNode,
  c: Record<string, unknown>,
): Promise<void> {
  const items = locatorFrom(ctx.page, c.locator as LocatorValue, ctx.vars);
  const total = await items.count();
  const limit = Number(c.limit) || total;
  const n = Math.min(total, limit);
  const bodyStart = edgeTarget(ctx, node.id, "loop");
  if (!bodyStart) return;

  const savedScope = ctx.scope;
  const savedIter = ctx.iteration;
  for (let i = 0; i < n; i++) {
    ctx.scope = items.nth(i);
    ctx.iteration = i;
    ctx.vars[`${(c.itemVar as string) || "item"}_index`] = String(i);
    await walk(ctx, bodyStart, node.id); // stop when body loops back to this node
  }
  ctx.scope = savedScope;
  ctx.iteration = savedIter;
}

/** Walk the graph from a node, following primary outputs, until stopAt or end. */
async function walk(
  ctx: Ctx,
  startId: string,
  stopAt?: string,
): Promise<void> {
  let current: string | undefined = startId;
  while (current && current !== stopAt) {
    if (++ctx.execCount > MAX_NODE_EXECUTIONS)
      throw new Error("Workflow exceeded the maximum number of steps");
    const node = ctx.nodeById.get(current);
    if (!node) break;
    const handle = await execNode(ctx, node);
    if (handle === null) break;
    current = edgeTarget(ctx, current, handle);
  }
}

async function writeCsv(
  ctx: Ctx,
  filename: string,
  rows: Record<string, string>[],
): Promise<string | undefined> {
  if (!ctx.captureDir || !ctx.urlPrefix) return undefined;
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [cols.map(esc).join(",")];
  for (const r of rows) lines.push(cols.map((k) => esc(r[k] ?? "")).join(","));
  const safe = filename.replace(/[^\w.\-]/g, "_") || "export.csv";
  await fs.writeFile(path.join(ctx.captureDir, safe), lines.join("\n"), "utf8");
  return `${ctx.urlPrefix}/${safe}`;
}

async function writeText(
  ctx: Ctx,
  filename: string,
  content: string,
): Promise<string | undefined> {
  if (!ctx.captureDir || !ctx.urlPrefix) return undefined;
  const safe = filename.replace(/[^\w.\-]/g, "_") || "output.txt";
  await fs.writeFile(path.join(ctx.captureDir, safe), content, "utf8");
  return `${ctx.urlPrefix}/${safe}`;
}

async function generateText(prompt: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return ""; // AI disabled — see run message
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  } catch {
    return "";
  }
}

/** Execute a whole workflow graph and return a structured run result. */
export async function executeWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<WorkflowRunResult> {
  const startedAt = new Date().toISOString();
  const startMs = performance.now();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Entry point: the Start node, else a node with no incoming edges.
  const start =
    nodes.find((n) => n.type === "start") ??
    nodes.find((n) => !edges.some((e) => e.target === n.id));

  const cap = newCapture();
  await fs.mkdir(cap.captureDir, { recursive: true });

  const { firefox } = await import("playwright");
  const { profileDir } = await ensureFirefoxProfile();
  const context = await firefox.launchPersistentContext(profileDir, {
    headless: true,
  });

  const ctx: Ctx = {
    page: context.pages()[0] ?? (await context.newPage()),
    vars: {},
    datasets: {},
    csv: {},
    textBuf: {},
    txt: {},
    results: [],
    nodeById,
    edges,
    captureDir: cap.captureDir,
    urlPrefix: cap.urlPrefix,
    seq: 0,
    execCount: 0,
  };

  let ok = true;
  let error: string | undefined;
  try {
    if (!start) throw new Error("Workflow has no Start node");
    await walk(ctx, start.id);
  } catch (err) {
    if (!(err instanceof EngineStop)) {
      error = err instanceof Error ? err.message : String(err);
    }
    ok = ctx.results.every((r) => r.ok);
  } finally {
    await context.close();
  }

  ok = ok && ctx.results.every((r) => r.ok) && !error;

  return {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startMs),
    nodes: ctx.results,
    datasets: ctx.datasets,
    csv: ctx.csv,
    txt: ctx.txt,
    texts: ctx.textBuf,
    error,
  };
}

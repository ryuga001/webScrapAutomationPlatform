import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Locator, Page } from "playwright";
import type { RunResult, Step, StepErrorType, StepResult } from "./types";
import { ensureFirefoxProfile } from "./browser";

const DEFAULT_ACTION_TIMEOUT = 15_000;

type RoleArg = Parameters<Page["getByRole"]>[0];

/** A short human phrase for the element a step targets. */
function targetDescription(step: Step): string {
  const q = step.selector ?? "";
  switch (step.locatorType ?? "css") {
    case "text":
      return `the element with text “${q}”`;
    case "role":
      return q
        ? `the ${step.role ?? "element"} named “${q}”`
        : `the ${step.role ?? "element"}`;
    case "label":
      return `the field labelled “${q}”`;
    case "placeholder":
      return `the input with placeholder “${q}”`;
    case "testid":
      return `the element with test id “${q}”`;
    case "css":
    default:
      return `the element matching “${q}”`;
  }
}

/**
 * Build a Playwright Locator from a step's chosen strategy. This is what turns a
 * friendly "find by Text: Show all" into the right query, instead of treating
 * every string as a CSS selector.
 */
function resolveLocator(page: Page, step: Step): Locator {
  const q = step.selector ?? "";
  switch (step.locatorType ?? "css") {
    case "text":
      return page.getByText(q);
    case "role":
      return page.getByRole(
        (step.role || "button") as RoleArg,
        q ? { name: q } : undefined,
      );
    case "label":
      return page.getByLabel(q);
    case "placeholder":
      return page.getByPlaceholder(q);
    case "testid":
      return page.getByTestId(q);
    case "css":
    default:
      return page.locator(q);
  }
}

/** Turn a raw Playwright/JS error into a classified, human-readable failure. */
function classifyError(
  step: Step,
  err: unknown,
): { errorType: StepErrorType; message: string; detail: string } {
  const detail = err instanceof Error ? err.message : String(err);
  const secs = Math.round((step.timeoutMs ?? DEFAULT_ACTION_TIMEOUT) / 1000);
  const target = targetDescription(step);
  const locatorAction =
    step.action === "click" ||
    step.action === "fill" ||
    step.action === "type" ||
    step.action === "waitForSelector" ||
    (step.action === "expectText" && !!step.selector);

  if (/strict mode violation|resolved to \d+ elements/i.test(detail)) {
    const count = detail.match(/resolved to (\d+) elements/i)?.[1];
    return {
      errorType: "ambiguous",
      message: `${cap(target)} matched ${
        count ? `${count} elements` : "multiple elements"
      }. Make it more specific (e.g. use Role + name, a Test ID, or a CSS selector).`,
      detail,
    };
  }

  if (/net::|NS_ERROR|ERR_|Navigation|goto|net_error/i.test(detail)) {
    return {
      errorType: "navigation",
      message: `Couldn't open the page — check the URL is reachable. (${firstLine(
        detail,
      )})`,
      detail,
    };
  }

  if (/Timeout .* exceeded/i.test(detail)) {
    if (locatorAction) {
      return {
        errorType: "not_found",
        message: `Couldn't find ${target} within ${secs}s. It may not exist, be hidden, load later, or the identifier may be wrong — try a different "Find by".`,
        detail,
      };
    }
    if (step.action === "expectText") {
      return {
        errorType: "assertion",
        message: `Expected text “${step.value ?? ""}” did not appear within ${secs}s.`,
        detail,
      };
    }
    return {
      errorType: "timeout",
      message: `Step timed out after ${secs}s.`,
      detail,
    };
  }

  if (/requires|invalid/i.test(detail)) {
    return { errorType: "invalid", message: detail, detail };
  }

  return { errorType: "error", message: firstLine(detail), detail };
}

function firstLine(s: string): string {
  return s.split("\n")[0].trim();
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export interface RunOptions {
  /** Absolute directory to write per-step screenshots into. */
  captureDir?: string;
  /** Public URL prefix that maps to `captureDir` (e.g. "/runs/<id>"). */
  urlPrefix?: string;
}

/**
 * Allocate a fresh capture location under `public/runs/<id>` so screenshots are
 * served statically by Next at the returned `urlPrefix`.
 */
export function newCapture(): Required<RunOptions> {
  const id = randomUUID();
  return {
    captureDir: path.join(process.cwd(), "public", "runs", id),
    urlPrefix: `/runs/${id}`,
  };
}

/** Capture a screenshot for a step; returns the public URL or undefined. */
async function capture(
  page: Page,
  index: number,
  opts: RunOptions,
): Promise<string | undefined> {
  if (!opts.captureDir || !opts.urlPrefix) return undefined;
  try {
    const file = `step-${index}.jpg`;
    await page.screenshot({
      path: path.join(opts.captureDir, file),
      type: "jpeg",
      quality: 60,
    });
    return `${opts.urlPrefix}/${file}`;
  } catch {
    return undefined;
  }
}

function describe(step: Step): string {
  const target = targetDescription(step);
  switch (step.action) {
    case "goto":
      return `Go to ${step.value ?? ""}`;
    case "click":
      return `Click ${target}`;
    case "fill":
      return `Fill ${target} with “${step.value ?? ""}”`;
    case "type":
      return `Type “${step.value ?? ""}” into ${target}`;
    case "press":
      return step.selector
        ? `Press ${step.value ?? ""} on ${target}`
        : `Press ${step.value ?? ""}`;
    case "waitForSelector":
      return `Wait for ${target}`;
    case "waitForTimeout":
      return `Wait ${step.value ?? "0"}ms`;
    case "expectText":
      return step.selector
        ? `Expect “${step.value ?? ""}” in ${target}`
        : `Expect text “${step.value ?? ""}”`;
    case "screenshot":
      return "Capture screenshot";
    default:
      return step.action;
  }
}

async function runStep(page: Page, step: Step): Promise<void> {
  const timeout = step.timeoutMs ?? DEFAULT_ACTION_TIMEOUT;
  switch (step.action) {
    case "goto":
      if (!step.value) throw new Error("This step requires a URL");
      await page.goto(step.value, { timeout, waitUntil: "domcontentloaded" });
      break;
    case "click":
      if (!step.selector) throw new Error("This step requires an identifier");
      await resolveLocator(page, step).first().click({ timeout });
      break;
    case "fill":
      if (!step.selector) throw new Error("This step requires an identifier");
      await resolveLocator(page, step).first().fill(step.value ?? "", { timeout });
      break;
    case "type":
      if (!step.selector) throw new Error("This step requires an identifier");
      await resolveLocator(page, step)
        .first()
        .pressSequentially(step.value ?? "", { timeout });
      break;
    case "press":
      if (!step.value) throw new Error("This step requires a key");
      if (step.selector) {
        await resolveLocator(page, step).first().press(step.value, { timeout });
      } else {
        await page.keyboard.press(step.value);
      }
      break;
    case "waitForSelector":
      if (!step.selector) throw new Error("This step requires an identifier");
      await resolveLocator(page, step)
        .first()
        .waitFor({ state: "visible", timeout });
      break;
    case "waitForTimeout": {
      const ms = Number(step.value ?? 0);
      if (!Number.isFinite(ms) || ms < 0) throw new Error("invalid wait duration");
      await page.waitForTimeout(Math.min(ms, 60_000));
      break;
    }
    case "expectText": {
      if (!step.value) throw new Error("This step requires text to expect");
      if (step.selector) {
        await resolveLocator(page, step)
          .filter({ hasText: step.value })
          .first()
          .waitFor({ state: "visible", timeout });
      } else {
        await page.getByText(step.value, { exact: false }).first().waitFor({
          state: "visible",
          timeout,
        });
      }
      break;
    }
    case "screenshot":
      await page.screenshot();
      break;
    default:
      throw new Error(`Unknown action: ${step.action}`);
  }
}

/**
 * Run a task's automation with Playwright: open a fresh Chromium page, navigate
 * to the task URL, then execute each step in order. Each step is timed and
 * captured individually; once a step fails the remaining steps are skipped.
 */
export async function runTask(
  url: string,
  steps: Step[],
  opts: RunOptions = {},
): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const startMs = performance.now();
  const results: StepResult[] = [];
  let ok = true;
  let topError: string | undefined;

  if (opts.captureDir) {
    await fs.mkdir(opts.captureDir, { recursive: true });
  }

  // Import lazily so the heavy Playwright module isn't pulled into cold starts
  // for routes that never run automation.
  const { firefox } = await import("playwright");

  // Launch Firefox against a working copy of the user's real profile so their
  // existing logins/cookies are reused — no need to sign in again.
  const { profileDir } = await ensureFirefoxProfile();
  const context = await firefox.launchPersistentContext(profileDir, {
    headless: true,
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());

    // Implicit first step: navigate to the task's URL.
    const navStart = performance.now();
    try {
      await page.goto(url, {
        timeout: DEFAULT_ACTION_TIMEOUT,
        waitUntil: "domcontentloaded",
      });
      results.push({
        index: 0,
        action: "goto",
        description: `Open ${url}`,
        ok: true,
        durationMs: Math.round(performance.now() - navStart),
        screenshot: await capture(page, 0, opts),
      });
    } catch (err) {
      ok = false;
      const c = classifyError({ id: "nav", action: "goto", value: url }, err);
      results.push({
        index: 0,
        action: "goto",
        description: `Open ${url}`,
        ok: false,
        message: c.message,
        errorType: c.errorType,
        detail: c.detail,
        durationMs: Math.round(performance.now() - navStart),
        screenshot: await capture(page, 0, opts),
      });
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const index = i + 1;
      const description = describe(step);

      if (!ok) {
        results.push({ index, action: step.action, description, ok: false, skipped: true, durationMs: 0 });
        continue;
      }

      const stepStart = performance.now();
      try {
        await runStep(page, step);
        results.push({
          index,
          action: step.action,
          description,
          ok: true,
          durationMs: Math.round(performance.now() - stepStart),
          screenshot: await capture(page, index, opts),
        });
      } catch (err) {
        ok = false;
        const c = classifyError(step, err);
        results.push({
          index,
          action: step.action,
          description,
          ok: false,
          message: c.message,
          errorType: c.errorType,
          detail: c.detail,
          durationMs: Math.round(performance.now() - stepStart),
          screenshot: await capture(page, index, opts),
        });
      }
    }
  } catch (err) {
    ok = false;
    topError = err instanceof Error ? err.message : String(err);
  } finally {
    await context.close();
  }

  return {
    ok,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Math.round(performance.now() - startMs),
    steps: results,
    error: topError,
  };
}

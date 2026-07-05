import { ensureFirefoxProfile } from "./browser";

export interface PickResult {
  ok: boolean;
  selector?: string;
  by?: "css";
  count?: number;
  error?: string;
}

// This function is serialized and injected into the target page (re-injected on
// every navigation). It shows a toolbar that lets the user FIRST browse freely
// to the page they want (search, log in, click through), then press "Pick" to
// arm selection. Once armed, hovering highlights elements and the next click
// computes a CSS selector (in "list" mode it generalizes to the repeating
// pattern and counts matches), reporting back via the exposed __webbotPick.
function pickerInit(mode: "single" | "list") {
  const w = window as unknown as {
    __webbotPick: (d: unknown) => void;
    __webbotPickerActive?: boolean;
  };
  if (w.__webbotPickerActive) return; // avoid double-injecting into one document
  w.__webbotPickerActive = true;

  const doc = document;
  const STABLE_BAD =
    /(^|[-_])(active|selected|current|hover|focus|open|show|hidden|is-|has-|ng-|css-|sc-)/i;

  const stableClasses = (el: Element): string[] =>
    Array.from(el.classList).filter(
      (c) => !STABLE_BAD.test(c) && !/\d{4,}/.test(c) && c.length < 40,
    );
  const esc = (s: string): string =>
    window.CSS && CSS.escape ? CSS.escape(s) : s;
  const count = (sel: string): number => {
    try {
      return doc.querySelectorAll(sel).length;
    } catch {
      return 0;
    }
  };
  function uniqueSelector(el: Element): string {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node.nodeType === 1 && node !== doc.body) {
      if (node.id && count("#" + esc(node.id)) === 1) {
        parts.unshift("#" + esc(node.id));
        break;
      }
      let part = node.tagName.toLowerCase();
      for (const attr of ["data-testid", "data-test", "data-qa"]) {
        const v = node.getAttribute(attr);
        if (v) {
          part = `${part}[${attr}="${v}"]`;
          break;
        }
      }
      const cls = stableClasses(node);
      if (cls.length) part += "." + cls.map(esc).join(".");
      const parent: Element | null = node.parentElement;
      if (parent && !part.includes("[") && cls.length === 0) {
        const same = Array.from(parent.children).filter(
          (c) => c.tagName === node!.tagName,
        );
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (count(parts.join(" > ")) === 1) break;
      node = parent;
    }
    return parts.join(" > ");
  }
  // Find the repeating item CONTAINER. Climb from the clicked element and,
  // while ancestors keep repeating with the SAME count (the list size), prefer
  // the outer one — so clicking the text inside a card still selects the card.
  function listSelector(el: Element): { selector: string; count: number } {
    let node: Element | null = el;
    let best: string | null = null;
    let bestCount = 0;
    while (node && node !== doc.body && node.parentElement) {
      const cls = stableClasses(node);
      if (cls.length) {
        const sel = node.tagName.toLowerCase() + "." + cls.map(esc).join(".");
        const n = count(sel);
        if (n > 1) {
          if (best === null) {
            best = sel;
            bestCount = n;
          } else if (n === bestCount) {
            best = sel; // same list size, but this ancestor is the outer container
          } else {
            break; // list size changed — stop at the consistent container level
          }
        }
      }
      node = node.parentElement;
    }
    if (best) return { selector: best, count: bestCount };
    const u = uniqueSelector(el);
    return { selector: u, count: count(u) };
  }

  let armed = false;

  // Highlight overlay (shown only while armed).
  const hl = doc.createElement("div");
  Object.assign(hl.style, {
    position: "fixed",
    zIndex: "2147483646",
    pointerEvents: "none",
    display: "none",
    background: "rgba(34,211,238,0.25)",
    border: "2px solid #06b6d4",
    borderRadius: "3px",
  } as CSSStyleDeclaration);

  // Toolbar with instructions + Pick / Cancel buttons.
  const bar = doc.createElement("div");
  Object.assign(bar.style, {
    position: "fixed",
    zIndex: "2147483647",
    top: "0",
    left: "0",
    right: "0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "8px 12px",
    background: "#0f172a",
    color: "#e5f5ff",
    font: "600 14px system-ui, sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  } as CSSStyleDeclaration);
  const label = doc.createElement("span");
  label.textContent =
    mode === "list"
      ? "Browse to your list, then press Pick and click one item"
      : "Browse to the page, then press Pick and click the element";
  const pickBtn = doc.createElement("button");
  pickBtn.textContent = mode === "list" ? "Pick a list item" : "Pick element";
  Object.assign(pickBtn.style, {
    background: "#22d3ee",
    color: "#0f172a",
    border: "0",
    borderRadius: "8px",
    padding: "6px 12px",
    font: "700 13px system-ui, sans-serif",
    cursor: "pointer",
  } as CSSStyleDeclaration);
  const cancelBtn = doc.createElement("button");
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    background: "transparent",
    color: "#e5f5ff",
    border: "1px solid #475569",
    borderRadius: "8px",
    padding: "6px 12px",
    cursor: "pointer",
  } as CSSStyleDeclaration);
  bar.appendChild(label);
  bar.appendChild(pickBtn);
  bar.appendChild(cancelBtn);
  doc.body.appendChild(hl);
  doc.body.appendChild(bar);

  function finish(payload: unknown) {
    hl.remove();
    bar.remove();
    doc.removeEventListener("mousemove", move, true);
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("keydown", onKey, true);
    w.__webbotPick(payload);
  }
  function move(e: MouseEvent) {
    if (!armed) return;
    const el = e.target as Element;
    if (!el || bar.contains(el)) return;
    const r = el.getBoundingClientRect();
    Object.assign(hl.style, {
      display: "block",
      top: r.top + "px",
      left: r.left + "px",
      width: r.width + "px",
      height: r.height + "px",
    });
  }
  function onClick(e: MouseEvent) {
    const el = e.target as Element;
    if (bar.contains(el)) return; // let toolbar buttons work
    if (!armed) return; // not armed: allow normal navigation/interaction
    e.preventDefault();
    e.stopPropagation();
    const res =
      mode === "list"
        ? listSelector(el)
        : { selector: uniqueSelector(el), count: 1 };
    finish({ selector: res.selector, count: res.count });
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") finish({ cancelled: true });
  }

  pickBtn.onclick = (e) => {
    e.stopPropagation();
    armed = true;
    pickBtn.style.display = "none";
    label.textContent =
      mode === "list"
        ? "Click one item in the list (Esc to cancel)"
        : "Click the element (Esc to cancel)";
  };
  cancelBtn.onclick = (e) => {
    e.stopPropagation();
    finish({ cancelled: true });
  };

  doc.addEventListener("mousemove", move, true);
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("keydown", onKey, true);
}

/** Open a headed browser at `url` and let the user click an element to pick. */
export async function pickElement(
  url: string,
  mode: "single" | "list",
): Promise<PickResult> {
  const { firefox } = await import("playwright");
  const { profileDir } = await ensureFirefoxProfile();

  let context;
  try {
    context = await firefox.launchPersistentContext(profileDir, {
      headless: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error:
        "Couldn't open a browser window. Close any running automation first, and make sure a desktop display is available. (" +
        msg +
        ")",
    };
  }

  const page = context.pages()[0] ?? (await context.newPage());
  let resolvePick: (v: { selector?: string; count?: number; cancelled?: boolean }) => void;
  const picked = new Promise<{ selector?: string; count?: number; cancelled?: boolean }>(
    (res) => (resolvePick = res),
  );

  try {
    await page.exposeFunction("__webbotPick", (data: unknown) =>
      resolvePick(data as { selector?: string; count?: number; cancelled?: boolean }),
    );

    // Re-inject the picker toolbar after every navigation, so the user can
    // freely browse (search, log in, click through) to reach the target page
    // and the "Pick" toolbar is always available there.
    const inject = () => page.evaluate(pickerInit, mode).catch(() => {});
    page.on("domcontentloaded", inject);

    try {
      await page.goto(url, { timeout: 30_000, waitUntil: "domcontentloaded" });
    } catch {
      // let the user pick even if the page didn't fully load
    }
    await inject(); // ensure it's present on the first page too

    const outcome = await Promise.race([
      picked,
      page
        .waitForEvent("close", { timeout: 290_000 })
        .then(() => ({ cancelled: true }))
        .catch(() => ({ timeout: true }) as { timeout?: boolean }),
    ]);

    if ("cancelled" in outcome && outcome.cancelled)
      return { ok: false, error: "Selection cancelled." };
    if ("selector" in outcome && outcome.selector)
      return { ok: true, selector: outcome.selector, by: "css", count: outcome.count ?? 1 };
    return { ok: false, error: "No element was selected." };
  } finally {
    await context.close().catch(() => {});
  }
}

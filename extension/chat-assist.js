// WebBot Chat Assist — injected on demand into the active tab. Lets the user
// click-select the chat message area + compose box, reads the conversation, asks
// the backend (via the background worker) for AI reply suggestions, and inserts
// the chosen reply into the compose box. Self-contained; runs in the content
// script isolated world, so chrome.* APIs are available.

(function () {
  if (window.__webbotChat) {
    // Already active — just re-open the panel.
    window.__webbotChat.reopen?.();
    return;
  }

  const HOST = location.hostname;
  const TARGETS_KEY = "webbotChatTargets";
  const PREFS_KEY = "webbotChatPrefs";
  const CONSENT_KEY = "webbotChatConsent";
  const Z = "2147483646";

  // Tone presets — kept in sync with src/lib/chat-suggest.ts (TONES).
  const TONES = [
    { id: "friendly", label: "Friendly" },
    { id: "professional", label: "Professional" },
    { id: "concise", label: "Concise" },
    { id: "warm", label: "Warm" },
    { id: "witty", label: "Witty" },
  ];

  // Reply languages — kept in sync with src/lib/chat-suggest.ts (LANGUAGES).
  const LANGUAGES = [
    "auto", "English", "Spanish", "French", "German", "Portuguese",
    "Italian", "Hindi", "Arabic", "Japanese", "Chinese",
  ];

  // ---- storage helpers ------------------------------------------------------
  const getStore = (k) =>
    new Promise((res) => chrome.storage.local.get(k, (v) => res(v[k])));
  const setStore = (k, v) =>
    new Promise((res) => chrome.storage.local.set({ [k]: v }, res));

  // ---- element resolution ---------------------------------------------------
  function cssPath(el) {
    if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1)
      return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && node !== document.body && depth < 8) {
      let part = node.tagName.toLowerCase();
      const cls = Array.from(node.classList)
        .filter((c) => !/^(is-|has-|js-)/.test(c) && !/\d{3,}/.test(c))
        .slice(0, 2);
      if (cls.length) part += "." + cls.map((c) => CSS.escape(c)).join(".");
      const parent = node.parentElement;
      if (parent) {
        const sibs = Array.from(parent.children).filter((s) => s.tagName === node.tagName);
        if (sibs.length > 1 && depth === 0) part += `:nth-of-type(${sibs.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = node.parentElement;
      depth++;
    }
    return parts.join(" > ");
  }
  const resolve = (sel) => {
    try {
      return sel ? document.querySelector(sel) : null;
    } catch {
      return null;
    }
  };

  // ---- overlay region picker (highlight + click) ----------------------------
  function pickElement(prompt) {
    return new Promise((resolve) => {
      const hl = document.createElement("div");
      Object.assign(hl.style, {
        position: "fixed", zIndex: "2147483647", pointerEvents: "none",
        background: "rgba(0,94,122,0.18)", border: "2px solid #005e7a",
        borderRadius: "6px", transition: "all 40ms linear", display: "none",
      });
      const bar = document.createElement("div");
      Object.assign(bar.style, {
        position: "fixed", zIndex: "2147483647", left: "50%", top: "16px",
        transform: "translateX(-50%)", background: "#111c2c", color: "#f9f9ff",
        font: "13px/1.4 system-ui,sans-serif", padding: "9px 16px",
        borderRadius: "9999px", boxShadow: "0 6px 24px rgba(0,0,0,.35)",
        pointerEvents: "none", whiteSpace: "nowrap",
      });
      bar.textContent = `${prompt}  ·  Esc = cancel`;
      document.documentElement.append(hl, bar);

      let current = null;
      const isOurs = (el) => el === hl || el === bar;
      const onMove = (e) => {
        const el = e.target;
        if (!el || isOurs(el)) return;
        current = el;
        const r = el.getBoundingClientRect();
        Object.assign(hl.style, {
          display: "block", left: r.left + "px", top: r.top + "px",
          width: r.width + "px", height: r.height + "px",
        });
      };
      const done = (sel) => {
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey, true);
        hl.remove();
        bar.remove();
        resolve(sel);
      };
      const onClick = (e) => {
        if (isOurs(e.target)) return;
        e.preventDefault();
        e.stopPropagation();
        done(current ? cssPath(current) : null);
      };
      const onKey = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          done(null);
        }
      };
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey, true);
    });
  }

  // ---- conversation reader --------------------------------------------------
  const MAX_MESSAGES = 15;
  const cleanText = (el) => (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();

  function readConversation(container) {
    if (!container) return [];

    // Best-effort per-platform adapters (most reliable), then a generic reader.
    if (/whatsapp\.com$/.test(HOST)) {
      const bubbles = container.querySelectorAll(".message-in, .message-out");
      if (bubbles.length) {
        const out = [];
        bubbles.forEach((b) => {
          const text = cleanText(b.querySelector("span.selectable-text") || b);
          if (text) out.push({ author: b.classList.contains("message-out") ? "me" : "them", text });
        });
        if (out.length) return out.slice(-MAX_MESSAGES);
      }
    }
    return readGeneric(container);
  }

  // Platform-agnostic: locate message rows, infer sender by horizontal alignment
  // (outgoing messages are right-aligned in virtually every chat UI).
  function readGeneric(container) {
    const cRect = container.getBoundingClientRect();
    const mid = cRect.left + cRect.width / 2;

    // Prefer semantic rows; fall back to the outermost text blocks.
    let rows = Array.from(container.querySelectorAll('[role="row"], [role="listitem"], li'));
    if (rows.length < 2) rows = outermostTextBlocks(container);

    const out = [];
    let last = "";
    for (const el of rows) {
      const text = cleanText(el);
      if (!text || text.length > 2000 || text === last) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 6) continue;
      const center = r.left + r.width / 2;
      // Right of centre and not near-full-width → likely mine; otherwise theirs.
      const author = center > mid && r.width < cRect.width * 0.9 ? "me" : "them";
      last = text;
      out.push({ author, text });
    }
    return out.slice(-MAX_MESSAGES);
  }

  // Top-most text-bearing blocks (a candidate not nested inside another candidate),
  // so we capture whole message bubbles without double-counting wrappers/children.
  function outermostTextBlocks(container) {
    const candidates = Array.from(container.querySelectorAll("div, p, li, span")).filter((el) => {
      const t = (el.textContent || "").trim();
      if (!t || t.length > 2000) return false;
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 8;
    });
    return candidates.filter((el) => !candidates.some((o) => o !== el && o.contains(el)));
  }

  // ---- insert / send into the compose box -----------------------------------

  // The clicked region may be a wrapper (e.g. WhatsApp's footer) — drill down to
  // the actual editable field so we never rewrite a container's DOM.
  function editableTarget(el) {
    if (!el) return null;
    if (el.matches && el.matches("input, textarea")) return el;
    if (el.isContentEditable) return el;
    const inner = el.querySelector(
      '[contenteditable="true"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea',
    );
    if (inner) return inner;
    return el.closest ? el.closest('[contenteditable="true"]') : null;
  }

  // Set an <input>/<textarea> value through the native setter so React/Vue see it.
  function setNativeValue(el, value) {
    const proto =
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  function insertReply(composeEl, text, send) {
    const target = editableTarget(composeEl);
    if (!target) return false;
    target.focus();

    if ("value" in target && !target.isContentEditable) {
      setNativeValue(target, text);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      // Rich contenteditable (WhatsApp/Lexical/Slate): TYPE the text via
      // execCommand so the editor's own handlers run — never touch textContent,
      // which replaces the editor's managed nodes and corrupts its state.
      document.execCommand("selectAll", false, null);
      const ok = document.execCommand("insertText", false, text);
      if (!ok) {
        target.dispatchEvent(
          new InputEvent("beforeinput", {
            bubbles: true, cancelable: true, inputType: "insertText", data: text,
          }),
        );
        target.dispatchEvent(
          new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }),
        );
      }
    }

    if (send) {
      const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true };
      target.dispatchEvent(new KeyboardEvent("keydown", opts));
      target.dispatchEvent(new KeyboardEvent("keyup", opts));
      if (target.form) target.form.requestSubmit?.();
    }
    return true;
  }

  // ---- panel UI -------------------------------------------------------------
  const state = {
    targets: null,
    tone: "friendly",
    persona: "",
    instruction: "",
    intent: "",
    systemPrompt: "",
    language: "auto",
    suggestions: [],
    busy: false,
  };
  let root = null;

  const PANEL_CSS = `position:fixed;right:20px;bottom:20px;width:340px;max-height:70vh;z-index:${Z};
    background:#f9f9ff;color:#111c2c;border:1px solid #d3dbe2;border-radius:16px;
    box-shadow:0 12px 40px rgba(17,28,44,.22);font:14px/1.4 "Manrope",system-ui,sans-serif;
    display:flex;flex-direction:column;overflow:hidden`;

  function button(label, kind) {
    const b = document.createElement("button");
    b.textContent = label;
    const base = "border:0;border-radius:10px;padding:9px 12px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;flex:1;";
    b.style.cssText = base + (kind === "primary"
      ? "background:#005e7a;color:#fff;"
      : "background:#f0f3ff;color:#40484d;border:1px solid #d3dbe2;");
    return b;
  }

  function renderPanel() {
    if (root) root.remove();
    root = document.createElement("div");
    root.style.cssText = PANEL_CSS;

    // header
    const head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #d3dbe2;";
    const title = document.createElement("div");
    title.innerHTML = `<strong style="color:#00455b">💬 Chat Assist</strong>`;
    const close = document.createElement("button");
    close.textContent = "✕";
    close.style.cssText = "border:0;background:transparent;cursor:pointer;color:#40484d;font-size:15px;";
    close.onclick = () => teardown();
    head.append(title, close);

    // body
    const body = document.createElement("div");
    body.style.cssText = "padding:12px 14px;overflow:auto;display:flex;flex-direction:column;gap:10px;";

    // tone chips
    const tones = document.createElement("div");
    tones.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;";
    TONES.forEach((t) => {
      const chip = document.createElement("button");
      chip.textContent = t.label;
      const active = state.tone === t.id;
      chip.style.cssText = `border:1px solid ${active ? "#005e7a" : "#d3dbe2"};background:${active ? "#dee8ff" : "#fff"};color:${active ? "#00455b" : "#40484d"};border-radius:9999px;padding:5px 11px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;`;
      chip.onclick = () => {
        state.tone = t.id;
        savePrefs();
        renderPanel();
        fetchSuggestions();
      };
      tones.append(chip);
    });

    // persona
    const persona = document.createElement("input");
    persona.placeholder = "Persona (e.g. a busy founder, casual)";
    persona.value = state.persona;
    persona.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #d3dbe2;border-radius:10px;padding:8px 10px;font-size:13px;font-family:inherit;color:#111c2c;background:#fff;outline:none;";
    persona.onchange = () => {
      state.persona = persona.value.trim();
      savePrefs();
      fetchSuggestions();
    };

    // instruction / prompt (the "actor" directive for this reply)
    const instruction = document.createElement("input");
    instruction.placeholder = "Instruction (e.g. politely decline, ask for a call)";
    instruction.value = state.instruction;
    instruction.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #d3dbe2;border-radius:10px;padding:8px 10px;font-size:13px;font-family:inherit;color:#111c2c;background:#fff;outline:none;";
    instruction.onchange = () => {
      state.instruction = instruction.value.trim();
      savePrefs();
      fetchSuggestions();
    };

    // conversation intent (the goal to steer toward)
    const intent = document.createElement("input");
    intent.placeholder = "Conversation intent (e.g. book a demo, keep them engaged)";
    intent.value = state.intent;
    intent.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #d3dbe2;border-radius:10px;padding:8px 10px;font-size:13px;font-family:inherit;color:#111c2c;background:#fff;outline:none;";
    intent.onchange = () => {
      state.intent = intent.value.trim();
      savePrefs();
      fetchSuggestions();
    };

    // reply language
    const langWrap = document.createElement("label");
    langWrap.style.cssText = "display:flex;align-items:center;gap:8px;font-size:12px;color:#40484d;";
    langWrap.append(document.createTextNode("Reply in"));
    const language = document.createElement("select");
    language.style.cssText = "flex:1;border:1px solid #d3dbe2;border-radius:10px;padding:7px 9px;font-size:13px;font-family:inherit;color:#111c2c;background:#fff;outline:none;";
    LANGUAGES.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l === "auto" ? "Auto (match chat)" : l;
      if (state.language === l) opt.selected = true;
      language.append(opt);
    });
    language.onchange = () => {
      state.language = language.value;
      savePrefs();
      fetchSuggestions();
    };
    langWrap.append(language);

    // advanced: full custom system prompt (collapsible)
    const advanced = document.createElement("details");
    advanced.open = !!state.systemPrompt;
    const summary = document.createElement("summary");
    summary.textContent = "Advanced: system prompt";
    summary.style.cssText = "cursor:pointer;font-size:12px;color:#40484d;font-weight:600;";
    const sys = document.createElement("textarea");
    sys.rows = 4;
    sys.placeholder =
      "Detailed instructions that override the defaults — e.g. who you are, rules, style, what to avoid…";
    sys.value = state.systemPrompt;
    sys.style.cssText = "margin-top:6px;width:100%;box-sizing:border-box;border:1px solid #d3dbe2;border-radius:10px;padding:9px 10px;font-size:13px;font-family:inherit;color:#111c2c;background:#fff;resize:vertical;outline:none;";
    sys.onchange = () => {
      state.systemPrompt = sys.value.trim();
      savePrefs();
      fetchSuggestions();
    };
    advanced.append(summary, sys);

    // suggestions
    const sugg = document.createElement("div");
    sugg.style.cssText = "display:flex;flex-direction:column;gap:6px;";
    if (state.busy) {
      const p = document.createElement("div");
      p.textContent = "Thinking…";
      p.style.cssText = "color:#40484d;font-size:13px;padding:4px 0;";
      sugg.append(p);
    } else if (state.error) {
      const p = document.createElement("div");
      p.textContent = state.error;
      p.style.cssText = "color:#ba1a1a;font-size:13px;padding:4px 0;";
      sugg.append(p);
    } else {
      state.suggestions.forEach((s) => {
        // Accept both a plain string and a { text, translation } object.
        const text = typeof s === "string" ? s : String(s?.text ?? "");
        const translation = typeof s === "object" && s ? s.translation : "";
        if (!text) return;
        const chip = document.createElement("button");
        chip.style.cssText = "display:flex;flex-direction:column;gap:3px;text-align:left;border:1px solid #d3dbe2;background:#fff;color:#111c2c;border-radius:10px;padding:9px 11px;font-size:13px;cursor:pointer;font-family:inherit;";
        const main = document.createElement("span");
        main.textContent = text;
        chip.append(main);
        if (translation) {
          const tr = document.createElement("span");
          tr.textContent = `🇬🇧 ${translation}`;
          tr.style.cssText = "color:#40484d;font-size:12px;font-style:italic;";
          chip.append(tr);
        }
        chip.onclick = () => {
          draft.value = text;
        };
        sugg.append(chip);
      });
    }

    // editable draft
    const draft = document.createElement("textarea");
    draft.rows = 3;
    draft.placeholder = "Pick a suggestion or write your own…";
    draft.style.cssText = "width:100%;box-sizing:border-box;border:1px solid #d3dbe2;border-radius:10px;padding:9px 10px;font-size:13px;font-family:inherit;color:#111c2c;background:#fff;resize:vertical;outline:none;";

    // actions
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;gap:8px;";
    const refresh = button("↻ Refresh");
    refresh.onclick = () => fetchSuggestions();
    const vary = button("🎲 Vary");
    vary.title = "Generate more varied, random options";
    vary.onclick = () => fetchSuggestions(true);
    const insert = button("Insert");
    insert.onclick = () => doInsert(draft.value, false);
    const send = button("Send", "primary");
    send.onclick = () => doInsert(draft.value, true);
    actions.append(refresh, vary, insert, send);

    // footer: re-select regions
    const reselect = document.createElement("button");
    reselect.textContent = "Re-select chat regions";
    reselect.style.cssText = "background:transparent;border:0;color:#40484d;font-size:12px;cursor:pointer;text-decoration:underline;font-family:inherit;align-self:flex-start;";
    reselect.onclick = () => reselectRegions();

    body.append(tones, persona, instruction, intent, langWrap, advanced, sugg, draft, actions, reselect);
    root.append(head, body);
    document.documentElement.append(root);
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#111c2c;color:#f9f9ff;padding:8px 14px;border-radius:9999px;font:13px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.3);`;
    document.documentElement.append(t);
    setTimeout(() => t.remove(), 2200);
  }

  // ---- behaviour ------------------------------------------------------------
  function savePrefs() {
    setStore(PREFS_KEY, {
      tone: state.tone,
      persona: state.persona,
      instruction: state.instruction,
      intent: state.intent,
      systemPrompt: state.systemPrompt,
      language: state.language,
    });
  }

  async function fetchSuggestions(creative = false) {
    const container = resolve(state.targets?.messages);
    const messages = readConversation(container);
    if (!messages.length) {
      state.error = "No messages found — try re-selecting the chat region.";
      renderPanel();
      return;
    }
    state.busy = true;
    state.error = null;
    renderPanel();
    try {
      const resp = await chrome.runtime.sendMessage({
        __webbot: true,
        type: "SUGGEST_REPLIES",
        messages,
        tone: state.tone,
        persona: state.persona || undefined,
        instruction: state.instruction || undefined,
        intent: state.intent || undefined,
        systemPrompt: state.systemPrompt || undefined,
        language: state.language || undefined,
        creative,
      });
      state.busy = false;
      if (!resp || resp.error) {
        state.error = resp?.error || "Couldn't reach the AI service.";
      } else {
        state.suggestions = resp.suggestions || [];
        state.error = state.suggestions.length ? null : "No suggestions returned.";
      }
    } catch {
      state.busy = false;
      state.error = "Couldn't reach the AI service.";
    }
    renderPanel();
  }

  function doInsert(text, send) {
    const value = (text || "").trim();
    if (!value) return toast("Nothing to insert.");
    const compose = resolve(state.targets?.compose);
    if (!compose) return toast("Compose box not found — re-select regions.");
    insertReply(compose, value, send);
    toast(send ? "Sent." : "Inserted.");
  }

  function teardown() {
    root?.remove();
    root = null;
    observer?.disconnect();
    window.__webbotChat = null;
  }

  let observer = null;
  function watchForNewMessages() {
    observer?.disconnect();
    const container = resolve(state.targets?.messages);
    if (!container) return;
    let timer = null;
    observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => fetchSuggestions(), 1500);
    });
    observer.observe(container, { childList: true, subtree: true });
  }

  async function selectRegions() {
    const messages = await pickElement("Click the CHAT MESSAGES area");
    if (!messages) return null;
    const compose = await pickElement("Now click the MESSAGE INPUT box");
    if (!compose) return null;
    const targets = { messages, compose };
    const all = (await getStore(TARGETS_KEY)) || {};
    all[HOST] = targets;
    await setStore(TARGETS_KEY, all);
    return targets;
  }

  async function reselectRegions() {
    root?.remove();
    root = null;
    const targets = await selectRegions();
    if (!targets) return start(); // cancelled → re-open with old targets
    state.targets = targets;
    renderPanel();
    watchForNewMessages();
    fetchSuggestions();
  }

  async function ensureConsent() {
    if (await getStore(CONSENT_KEY)) return true;
    const ok = confirm(
      "WebBot Chat Assist will read the messages in the chat you select and send " +
        "them to your WebBot backend and Google Gemini to generate reply suggestions.\n\n" +
        "Only use this on conversations you're comfortable processing. Continue?",
    );
    if (ok) await setStore(CONSENT_KEY, true);
    return ok;
  }

  async function start() {
    if (!(await ensureConsent())) return;
    const prefs = (await getStore(PREFS_KEY)) || {};
    state.tone = prefs.tone || state.tone;
    state.persona = prefs.persona || "";
    state.instruction = prefs.instruction || "";
    state.intent = prefs.intent || "";
    state.systemPrompt = prefs.systemPrompt || "";
    state.language = prefs.language || "auto";

    const saved = (await getStore(TARGETS_KEY)) || {};
    let targets = saved[HOST];
    if (!targets || !resolve(targets.messages) || !resolve(targets.compose)) {
      targets = await selectRegions();
      if (!targets) return;
    }
    state.targets = targets;
    renderPanel();
    watchForNewMessages();
    fetchSuggestions();
  }

  window.__webbotChat = { reopen: () => (root ? null : renderPanel()) };
  start();
})();

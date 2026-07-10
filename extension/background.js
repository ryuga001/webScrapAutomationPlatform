// WebBot background service worker.
//
// Two responsibilities:
//   1. Runs workflows OUT of the popup, so a run survives the popup closing
//      ("minimize"). Progress is persisted to chrome.storage so the popup can
//      re-render it whenever it's reopened, and broadcast live to an open popup.
//   2. Bridges the dashboard's "Pick from page" button to the element picker.
//
// The executor lives in executor.js. Chrome loads this as a service worker, so
// we importScripts() it; Firefox loads both via manifest background.scripts, so
// importScripts is undefined there and this is skipped.
if (typeof importScripts === "function") {
  try {
    importScripts("executor.js");
  } catch {
    /* Firefox already loaded it via background.scripts */
  }
}

const RUN_KEY = "webbotRun";

// ---- workflow execution ---------------------------------------------------

let keepAliveTimer = null;

// MV3 service workers sleep after ~30s idle. A periodic no-op API call while a
// run is in progress resets that timer. Best-effort — very long idle waits can
// still suspend the worker (progress is persisted regardless).
function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    chrome.runtime.getPlatformInfo().catch(() => {});
  }, 20000);
}
function stopKeepAlive() {
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  keepAliveTimer = null;
}

async function persistRun(state) {
  await chrome.storage.local.set({ [RUN_KEY]: state });
  // Notify an open popup (ignored if none is listening).
  chrome.runtime.sendMessage({ __webbot: true, type: "RUN_STATE", state }).catch(() => {});
}

// Control channel + current state for the in-flight run (module scope so the
// message router can pause/resume/stop it).
let runControl = null;
let currentState = null;

async function startRun(workflow, tabId) {
  runControl = { paused: false, stopped: false };
  const state = {
    status: "running",
    name: workflow.name || "Workflow",
    steps: [],
    ok: null,
    files: {},
    datasets: {},
    error: null,
    dismissed: false,
  };
  currentState = state;
  await persistRun(state);
  startKeepAlive();

  const onProgress = (r) => {
    state.steps.push({
      label: r.label,
      ok: r.ok,
      warning: !!r.warning,
      message: r.message,
      iteration: r.iteration,
    });
    persistRun(state);
  };

  const control = {
    shouldStop: () => runControl.stopped,
    waitWhilePaused: async () => {
      while (runControl.paused && !runControl.stopped) {
        await new Promise((r) => setTimeout(r, 200));
      }
    },
  };

  try {
    const result = await WebBotExecutor.runWorkflow(workflow, tabId, onProgress, control);
    state.status = runControl.stopped ? "stopped" : result.ok ? "done" : "error";
    state.ok = result.ok;
    state.files = result.files || {};
    state.datasets = result.datasets || {};
  } catch (e) {
    state.status = "error";
    state.ok = false;
    state.error = e && e.message ? e.message : String(e);
  } finally {
    stopKeepAlive();
    runControl = null;
    currentState = null;
    await persistRun(state);
  }
}

// ---- element picker bridge (unchanged) ------------------------------------

let builderTabId = null;

async function pickTargetTab() {
  const tabs = await chrome.tabs.query({});
  const usable = tabs.filter(
    (t) =>
      t.id !== builderTabId &&
      t.id != null &&
      /^https?:/.test(t.url || "") &&
      !(t.url || "").startsWith("chrome://"),
  );
  if (!usable.length) return null;
  usable.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return usable[0];
}

async function startPick() {
  const target = await pickTargetTab();
  if (!target) {
    if (builderTabId != null) {
      chrome.tabs.sendMessage(builderTabId, {
        __webbot: true,
        type: "PICK_RESULT",
        cancelled: true,
        error: "Open the page you want to automate in another tab, then pick again.",
      });
    }
    return;
  }
  try {
    await chrome.windows.update(target.windowId, { focused: true });
    await chrome.tabs.update(target.id, { active: true });
  } catch {
    /* best effort */
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: target.id },
      files: ["picker.js"],
    });
  } catch (e) {
    if (builderTabId != null) {
      chrome.tabs.sendMessage(builderTabId, {
        __webbot: true,
        type: "PICK_RESULT",
        cancelled: true,
        error: "Can't pick on this page (" + (e && e.message ? e.message : "blocked") + ").",
      });
    }
  }
}

// ---- message router -------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.__webbot) return;
  switch (msg.type) {
    case "RUN_WORKFLOW":
      if (msg.workflow && msg.tabId != null) startRun(msg.workflow, msg.tabId);
      break;
    case "START_CHAT_ASSIST":
      if (msg.tabId != null) startChatAssist(msg.tabId);
      break;
    case "SUGGEST_REPLIES":
      // Async: keep the message channel open for sendResponse.
      suggestReplies(msg).then(sendResponse);
      return true;
    case "PAUSE_RUN":
      if (runControl && currentState) {
        runControl.paused = true;
        currentState.status = "paused";
        persistRun(currentState);
      }
      break;
    case "RESUME_RUN":
      if (runControl && currentState) {
        runControl.paused = false;
        currentState.status = "running";
        persistRun(currentState);
      }
      break;
    case "STOP_RUN":
      // Loop exits at its next checkpoint; the run's finally sets "stopped".
      if (runControl) {
        runControl.stopped = true;
        runControl.paused = false;
      }
      break;
    case "START_PICK":
      builderTabId = sender.tab && sender.tab.id != null ? sender.tab.id : null;
      startPick();
      break;
    case "PICK_RESULT":
      if (builderTabId != null) chrome.tabs.sendMessage(builderTabId, msg);
      if (!msg.cancelled && builderTabId != null) {
        chrome.tabs.update(builderTabId, { active: true }).catch(() => {});
      }
      break;
  }
});

// ---- chat assist ----------------------------------------------------------

async function startChatAssist(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["chat-assist.js"],
    });
  } catch {
    /* page may block injection (chrome://, store pages) — nothing to do */
  }
}

// Proxy the conversation to the backend so the API token (in chrome.storage,
// not exposed to the injected content script) stays out of page reach.
async function suggestReplies(msg) {
  const { backendUrl, apiToken } = await chrome.storage.local.get([
    "backendUrl",
    "apiToken",
  ]);
  if (!backendUrl) return { error: "Not connected — open the popup and sign in first." };
  try {
    const res = await fetch(`${backendUrl.replace(/\/+$/, "")}/api/ai/chat-suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify({
        messages: msg.messages,
        tone: msg.tone,
        persona: msg.persona,
        instruction: msg.instruction,
        intent: msg.intent,
        systemPrompt: msg.systemPrompt,
        language: msg.language,
        creative: msg.creative,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) return { error: "Slow down — too many requests. Try again shortly." };
      if (res.status === 401) return { error: "Sign in from the popup to use Chat Assist." };
      return { error: data.error || "AI service unavailable." };
    }
    return { suggestions: data.suggestions || [] };
  } catch {
    return { error: "Couldn't reach the backend." };
  }
}

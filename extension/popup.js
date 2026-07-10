// Popup: pick a workflow and hand it to the background worker to run. The run
// survives this popup closing; reopening the popup re-renders live progress
// from chrome.storage. The popup itself never executes the workflow.

const CONF = (typeof window !== "undefined" && window.WEBBOT_CONFIG) || {};

const pickerView = document.getElementById("view-picker");
const progressView = document.getElementById("view-progress");

const backendEl = document.getElementById("backend");
const tokenEl = document.getElementById("token");
const selectEl = document.getElementById("workflow");
const statusEl = document.getElementById("status");
const accountEl = document.getElementById("account");
const connEl = document.getElementById("conn");
const runBtn = document.getElementById("run");
const refreshBtn = document.getElementById("refresh");
const chatAssistBtn = document.getElementById("chat-assist");
const openDashboardBtn = document.getElementById("open-dashboard");

const runNameEl = document.getElementById("run-name");
const runPillEl = document.getElementById("run-pill");
const runPillText = document.getElementById("run-pill-text");
const logEl = document.getElementById("log");
const downloadsEl = document.getElementById("downloads");
const runControlsEl = document.getElementById("run-controls");
const pauseBtn = document.getElementById("pause");
const resumeBtn = document.getElementById("resume");
const stopBtn = document.getElementById("stop");
const backBtn = document.getElementById("back");

let workflows = [];

function backend() {
  return backendEl.value.replace(/\/+$/, "");
}
function authHeaders() {
  const t = tokenEl.value.trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function showView(name) {
  pickerView.classList.toggle("hidden", name !== "picker");
  progressView.classList.toggle("hidden", name !== "progress");
}

// ---- picker ---------------------------------------------------------------

async function loadWorkflows() {
  statusEl.textContent = "Loading workflows…";
  selectEl.innerHTML = "";
  try {
    await chrome.storage.local.set({
      backendUrl: backend(),
      apiToken: tokenEl.value.trim(),
    });
    const res = await fetch(`${backend()}/api/workflows`, { headers: authHeaders() });
    if (res.status === 401) {
      statusEl.textContent = "Not signed in — download your extension from the dashboard.";
      selectEl.innerHTML = "<option>(sign in required)</option>";
      return;
    }
    const data = await res.json();
    workflows = data.workflows || [];
    if (!workflows.length) {
      selectEl.innerHTML = "<option>(no workflows — create one in the dashboard)</option>";
      statusEl.textContent = "";
      return;
    }
    selectEl.innerHTML = workflows
      .map((w, i) => `<option value="${i}">${w.name} (${w.nodes.length} nodes)</option>`)
      .join("");
    statusEl.textContent = `${workflows.length} workflow(s) loaded`;
  } catch (e) {
    statusEl.textContent = "Couldn't reach backend: " + e.message;
    selectEl.innerHTML = "<option>(error)</option>";
  }
}

async function run() {
  const wf = workflows[Number(selectEl.value)];
  if (!wf) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    statusEl.textContent = "No active tab to run on.";
    return;
  }
  // Hand off to the background worker, then minimize (close) the popup. The run
  // continues; reopen the popup any time to watch progress.
  chrome.runtime.sendMessage({
    __webbot: true,
    type: "RUN_WORKFLOW",
    workflow: wf,
    tabId: tab.id,
  });
  window.close();
}

// ---- progress -------------------------------------------------------------

const PILL = {
  running: { cls: "pill running", text: "Running…" },
  paused: { cls: "pill paused", text: "Paused" },
  stopped: { cls: "pill stopped", text: "Stopped" },
  done: { cls: "pill ok", text: "Finished" },
  error: { cls: "pill fail", text: "Finished with errors" },
};

function renderProgress(state) {
  runNameEl.textContent = state.name || "Workflow";
  const pill = PILL[state.status] || PILL.running;
  runPillEl.className = pill.cls;
  runPillText.textContent = pill.text;

  // Show pause/resume/stop only while the run is live.
  const active = state.status === "running" || state.status === "paused";
  runControlsEl.classList.toggle("hidden", !active);
  pauseBtn.classList.toggle("hidden", state.status !== "running");
  resumeBtn.classList.toggle("hidden", state.status !== "paused");

  logEl.innerHTML = "";
  for (const s of state.steps || []) {
    const cls = !s.ok ? "fail" : s.warning ? "warn" : "ok";
    const mark = cls === "ok" ? "✓" : cls === "warn" ? "!" : "✗";
    const iter = s.iteration !== undefined ? ` #${s.iteration + 1}` : "";
    const d = document.createElement("div");
    d.className = "item " + cls;
    d.innerHTML =
      `<span class="mark">${mark}</span>` +
      `<span>${s.label}${iter}${s.message ? " — " + s.message : ""}</span>`;
    logEl.appendChild(d);
  }
  if (state.error) {
    const d = document.createElement("div");
    d.className = "item fail";
    d.innerHTML = `<span class="mark">✗</span><span>${state.error}</span>`;
    logEl.appendChild(d);
  }
  logEl.scrollTop = logEl.scrollHeight;

  // Download links only once the run has finished producing files.
  downloadsEl.innerHTML = "";
  if (state.status !== "running") {
    for (const [name, file] of Object.entries(state.files || {})) {
      const url = URL.createObjectURL(new Blob([file.content], { type: file.type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.textContent = "⬇ " + name;
      downloadsEl.appendChild(a);
    }
  }
}

async function back() {
  const { webbotRun } = await chrome.storage.local.get("webbotRun");
  if (webbotRun) {
    webbotRun.dismissed = true;
    await chrome.storage.local.set({ webbotRun });
  }
  showView("picker");
  await loadWorkflows();
}

// ---- init -----------------------------------------------------------------

async function init() {
  const { backendUrl, apiToken, webbotRun } = await chrome.storage.local.get([
    "backendUrl",
    "apiToken",
    "webbotRun",
  ]);
  backendEl.value = CONF.backendUrl || backendUrl || backendEl.value;
  tokenEl.value = CONF.apiToken || apiToken || "";
  if (CONF.apiToken) {
    connEl.classList.add("hidden");
    accountEl.textContent = CONF.username ? `Signed in as ${CONF.username}` : "Signed in";
    accountEl.classList.remove("hidden");
  }

  // Show the progress view for an in-flight run, or a finished one not yet
  // dismissed. Otherwise go straight to the workflow picker.
  if (webbotRun && (webbotRun.status === "running" || !webbotRun.dismissed)) {
    showView("progress");
    renderProgress(webbotRun);
  } else {
    showView("picker");
    await loadWorkflows();
  }
}

// Live updates from the background worker while the popup is open.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.__webbot && msg.type === "RUN_STATE" && msg.state) {
    showView("progress");
    renderProgress(msg.state);
  }
});

function sendControl(type) {
  chrome.runtime.sendMessage({ __webbot: true, type });
}

pauseBtn.addEventListener("click", () => sendControl("PAUSE_RUN"));
resumeBtn.addEventListener("click", () => sendControl("RESUME_RUN"));
stopBtn.addEventListener("click", () => {
  runPillText.textContent = "Stopping…";
  stopBtn.disabled = true;
  sendControl("STOP_RUN");
});

refreshBtn.addEventListener("click", loadWorkflows);
runBtn.addEventListener("click", run);
backBtn.addEventListener("click", back);

// Inject Chat Assist into the active tab, then close the popup so the in-page
// overlay takes over.
chatAssistBtn.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    statusEl.textContent = "No active tab for Chat Assist.";
    return;
  }
  chrome.runtime.sendMessage({ __webbot: true, type: "START_CHAT_ASSIST", tabId: tab.id });
  window.close();
});

openDashboardBtn.addEventListener("click", () => {
  chrome.tabs.create({ url: `${backend()}/workflows` });
});

init();

// Popup: load workflows from the dashboard backend, then run the selected one
// on the current tab via the executor.

const backendEl = document.getElementById("backend");
const tokenEl = document.getElementById("token");
const selectEl = document.getElementById("workflow");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const downloadsEl = document.getElementById("downloads");
const runBtn = document.getElementById("run");
const refreshBtn = document.getElementById("refresh");

// Collapsible run-progress panel.
const progressEl = document.getElementById("progress");
const progressToggleEl = document.getElementById("progress-toggle");
const progressBadgeEl = document.getElementById("progress-badge");
const progressEmptyEl = document.getElementById("progress-empty");

let workflows = [];
let progressOpen = false;
let pendingSteps = 0; // unseen progress lines while collapsed

function updateBadge() {
  if (!progressOpen && pendingSteps > 0) {
    progressBadgeEl.textContent = pendingSteps > 99 ? "99+" : String(pendingSteps);
    progressBadgeEl.classList.remove("hidden");
  } else {
    progressBadgeEl.classList.add("hidden");
  }
}

function setProgressOpen(open) {
  progressOpen = open;
  progressEl.classList.toggle("hidden", !open);
  progressToggleEl.querySelector(".ic-list").classList.toggle("hidden", open);
  progressToggleEl.querySelector(".ic-close").classList.toggle("hidden", !open);
  progressToggleEl.setAttribute("aria-expanded", String(open));
  progressToggleEl.title = open ? "Hide run progress" : "Show run progress";
  if (open) {
    pendingSteps = 0;
    updateBadge();
    logEl.scrollTop = logEl.scrollHeight;
  }
}

function backend() {
  return backendEl.value.replace(/\/+$/, "");
}

const CONF = (typeof window !== "undefined" && window.WEBBOT_CONFIG) || {};
const accountEl = document.getElementById("account");
const connEl = document.getElementById("conn");

function authHeaders() {
  const t = tokenEl.value.trim();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function init() {
  const { backendUrl, apiToken } = await chrome.storage.local.get([
    "backendUrl",
    "apiToken",
  ]);
  // Precedence: baked config (from a downloaded extension) > stored > default.
  backendEl.value = CONF.backendUrl || backendUrl || backendEl.value;
  tokenEl.value = CONF.apiToken || apiToken || "";

  // When credentials are baked in, hide the manual connection fields and show
  // who's signed in — the user never touches a token.
  if (CONF.apiToken) {
    connEl.classList.add("hidden");
    accountEl.textContent = CONF.username
      ? `Signed in as ${CONF.username}`
      : "Signed in";
  }
  await loadWorkflows();
}

async function loadWorkflows() {
  statusEl.textContent = "Loading workflows…";
  selectEl.innerHTML = "";
  try {
    await chrome.storage.local.set({
      backendUrl: backend(),
      apiToken: tokenEl.value.trim(),
    });
    const res = await fetch(`${backend()}/api/workflows`, {
      headers: authHeaders(),
    });
    if (res.status === 401) {
      statusEl.textContent =
        "Not signed in — paste your API token from the dashboard (Copy API token).";
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

function line(cls, text) {
  const d = document.createElement("div");
  d.className = "item";
  d.innerHTML = `<span class="${cls}">${cls === "ok" ? "✓" : cls === "warn" ? "!" : "✗"}</span><span>${text}</span>`;
  logEl.appendChild(d);
  logEl.scrollTop = logEl.scrollHeight;
  // While collapsed, surface activity on the circle without forcing it open.
  if (!progressOpen) {
    pendingSteps++;
    updateBadge();
  }
}

async function run() {
  const wf = workflows[Number(selectEl.value)];
  if (!wf) return;
  logEl.innerHTML = "";
  downloadsEl.innerHTML = "";
  if (progressEmptyEl) progressEmptyEl.classList.add("hidden");
  runBtn.disabled = true;
  statusEl.textContent = "Running…";
  // Reset the circle: pulsing while running, no stale result colour or badge.
  pendingSteps = 0;
  updateBadge();
  progressToggleEl.classList.remove("done-ok", "done-fail");
  progressToggleEl.classList.add("running");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) {
    statusEl.textContent = "No active tab.";
    runBtn.disabled = false;
    progressToggleEl.classList.remove("running");
    return;
  }

  const onProgress = (r) => {
    const cls = !r.ok ? "fail" : r.warning ? "warn" : "ok";
    const iter = r.iteration !== undefined ? ` #${r.iteration + 1}` : "";
    line(cls, `${r.label}${iter}${r.message ? " — " + r.message : ""}`);
  };

  try {
    const result = await WebBotExecutor.runWorkflow(wf, tab.id, onProgress);
    statusEl.textContent = result.ok ? "✓ Finished" : "✗ Finished with errors";
    progressToggleEl.classList.toggle("done-ok", result.ok);
    progressToggleEl.classList.toggle("done-fail", !result.ok);

    // Downloads for any produced files
    for (const [name, file] of Object.entries(result.files || {})) {
      const url = URL.createObjectURL(new Blob([file.content], { type: file.type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.textContent = "⬇ " + name;
      downloadsEl.appendChild(a);
    }
    // Dataset summary
    for (const [ds, rows] of Object.entries(result.datasets || {})) {
      if (rows.length) line("ok", `dataset "${ds}": ${rows.length} row(s)`);
    }
  } catch (e) {
    statusEl.textContent = "Error: " + e.message;
    progressToggleEl.classList.add("done-fail");
  } finally {
    runBtn.disabled = false;
    progressToggleEl.classList.remove("running");
  }
}

progressToggleEl.addEventListener("click", () => setProgressOpen(!progressOpen));
refreshBtn.addEventListener("click", loadWorkflows);
runBtn.addEventListener("click", run);
init();

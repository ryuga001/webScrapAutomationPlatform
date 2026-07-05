// Runs in the popup. When you click "Scrape page", it injects `scrapePage`
// into the ACTIVE TAB (the page you're looking at, with your session) and gets
// the results back. This is the extension equivalent of WebBot's Extract node.

let lastResults = [];

// This function is serialized and executed INSIDE the web page.
function scrapePage(selector) {
  const els = Array.from(document.querySelectorAll(selector));
  return els.map((el) => ({
    text: (el.textContent || "").trim().replace(/\s+/g, " "),
    href: el.getAttribute("href") || "",
  }));
}

async function scrape() {
  const selector = document.getElementById("selector").value.trim() || "a";
  const results = document.getElementById("results");
  const count = document.getElementById("count");

  // Which tab is active?
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    count.textContent = "No active tab.";
    return;
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapePage,
      args: [selector],
    });
    lastResults = result || [];
    count.textContent = `Matched ${lastResults.length} element(s)`;
    results.textContent = lastResults
      .slice(0, 100)
      .map((r) => (r.href ? `${r.text} — ${r.href}` : r.text))
      .join("\n");
  } catch (err) {
    count.textContent = "Error: " + err.message;
  }
}

function download() {
  if (!lastResults.length) return;
  const text = lastResults
    .map((r) => (r.href ? `${r.text}\t${r.href}` : r.text))
    .join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "scrape.txt";
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("scrape").addEventListener("click", scrape);
document.getElementById("download").addEventListener("click", download);

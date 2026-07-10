# WebBot Runner (browser extension)

Runs WebBot workflows **in your own browser**, on your logged-in sessions —
no Playwright, no server-side browser. The dashboard (the Next.js app) is only
used to **create/save** workflows; this extension **executes** them.

## Recommended: download your pre-configured copy

The easiest path — no manual token pasting:

1. Sign in to the dashboard and click **Download my extension**.
2. Unzip it. The bundle already contains a `config.js` with your backend URL and
   a long-lived API token, so the popup works immediately.
3. Load the unzipped folder (see "Load it locally" below).

Re-download to refresh the token when it expires
(`EXTENSION_TOKEN_EXPIRES_IN`, default 30 days).

## Files
- `manifest.json` — extension definition + permissions
- `config.js` — backend URL + API token (a placeholder in the repo; overwritten
  in your downloaded bundle)
- `popup.html` / `popup.js` — the toolbar UI (pick a workflow, run it)
- `executor.js` — the workflow engine: walks the node graph and performs each
  step on the live page via `chrome.scripting`
- `picker.js` / `background.js` / `content-bridge.js` — the point-and-click
  element picker used by the dashboard's **Pick** button
- `chat-assist.js` — the **Chat Assist** overlay (AI reply suggestions)

## Chat Assist (AI reply suggestions)

Open the popup and click **💬 Chat Assist**. An overlay lets you click-select the
chat's **message area** and **input box** (remembered per site). It reads the
recent conversation and suggests replies you can tweak, **Insert**, or **Send**.

**Works on any chat site.** You pick the regions, so it isn't tied to one app.
Sender detection is by message alignment (outgoing = right-aligned), which holds
across most chat UIs; **WhatsApp Web** additionally uses an exact adapter. On apps
that left-align every message, senders may be read as incoming — the reply
suggestion is still generated from the conversation.

Steer the output with **tone**, **persona** (who to write as), a per-reply
**instruction**, the **conversation intent** (the goal), a **reply language**
(non-English replies show an English translation), and an advanced **system
prompt**. Use **🎲 Vary** for more varied options.

> **Privacy:** Chat Assist sends the messages in the chat you select to your
> WebBot backend and, from there, to **Google Gemini** to generate suggestions.
> You're asked to consent once per browser. Only use it on conversations you're
> comfortable processing. The AI key lives on the server — never in this extension.

Requires the backend to have `GEMINI_API_KEY` configured (see the app's
`.env`); without it the endpoint returns a 502 and the panel shows
"AI service unavailable."

## Load it locally

**Chrome / Edge / Brave**
1. Go to `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the extension folder

**Firefox**
1. Go to `about:debugging#/runtime/this-firefox`
2. **Load Temporary Add-on…** → select `manifest.json`

## Use it
1. Create + save a workflow in the dashboard
2. Open the tab/site you want to automate (log in there if needed)
3. Click the WebBot toolbar icon → pick the workflow → **Run on this tab**
4. Watch the per-node progress; download any CSV/TXT it produces

## Notes
- Runs execute in the **background service worker**, so you can close the popup
  ("minimize") while a workflow runs. Click the toolbar icon again any time to
  reopen and watch live progress; produced files appear as downloads when it
  finishes. (Very long idle waits may suspend the MV3 worker — progress is
  persisted, but avoid multi-minute Delay nodes with no page activity.)
- The starting page: if the workflow has a **Go to URL** node it navigates the
  current tab; otherwise it runs on whatever tab is already open.
- If you loaded the repo folder directly (not a download), enter the **Backend
  URL** and **API token** manually — get the token by using **Download my
  extension** and copying it from the bundle's `config.js`, or run the dashboard
  on `localhost:3000`.

// Background service worker (MV3). Receives JT_MARK_APPLIED messages, calls the API, notifies user.

const STORAGE_KEYS = ["apiBase", "apiKey"];

async function getConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(STORAGE_KEYS, (cfg) => resolve(cfg || {}));
  });
}

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.png"),
      title,
      message,
      priority: 1,
    });
  } catch {
    // notifications API isn't available in all contexts — ignore
  }
}

async function markApplied(url) {
  const { apiBase, apiKey } = await getConfig();
  if (!apiBase || !apiKey) {
    return { ok: false, error: "extension not configured" };
  }
  const base = apiBase.replace(/\/+$/, "");
  let res;
  try {
    res = await fetch(`${base}/api/jobs/applied`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, source: "extension" }),
    });
  } catch (e) {
    return { ok: false, error: e?.message || "network error" };
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, data };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "JT_MARK_APPLIED") return false;
  markApplied(msg.url).then(async (result) => {
    if (result.ok) {
      const job = result.data?.job;
      if (result.data?.noop) {
        await notify("Already marked", `${job?.title ?? "Job"} at ${job?.company ?? ""} was already applied.`);
      } else if (result.data?.matched) {
        await notify(
          "Applied",
          `${job?.title ?? "Job"}${job?.company ? ` · ${job.company}` : ""}`,
        );
      }
    } else if (result.status === 401) {
      await notify("Job Tracker — auth failed", "API key invalid. Open extension options to fix.");
    } else if (result.status === 404) {
      await notify(
        "Job Tracker — not in pipeline",
        "This job isn't in your tracker yet. The scraper picks new postings every 2 hours.",
      );
    } else if (result.error) {
      await notify("Job Tracker — error", result.error);
    }
    sendResponse(result);
  });
  return true; // keep message channel open for async sendResponse
});

chrome.runtime.onInstalled.addListener(async () => {
  const { apiBase, apiKey } = await getConfig();
  if (!apiBase || !apiKey) {
    chrome.runtime.openOptionsPage?.();
  }
});

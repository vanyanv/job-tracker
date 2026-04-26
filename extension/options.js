const $ = (id) => document.getElementById(id);
const status = $("status");

function setStatus(text, kind) {
  status.textContent = text;
  status.className = "status" + (kind ? ` ${kind}` : "");
}

async function load() {
  chrome.storage.sync.get(["apiBase", "apiKey"], (cfg) => {
    if (cfg.apiBase) $("apiBase").value = cfg.apiBase;
    if (cfg.apiKey) $("apiKey").value = cfg.apiKey;
  });
}

document.addEventListener("DOMContentLoaded", load);

$("cfg").addEventListener("submit", (e) => {
  e.preventDefault();
  const apiBase = $("apiBase").value.trim().replace(/\/+$/, "");
  const apiKey = $("apiKey").value.trim();
  if (!apiBase || !apiKey) {
    setStatus("Both fields are required", "err");
    return;
  }
  chrome.storage.sync.set({ apiBase, apiKey }, () => {
    setStatus("Saved", "ok");
    setTimeout(() => setStatus(""), 1500);
  });
});

$("test").addEventListener("click", async () => {
  const apiBase = $("apiBase").value.trim().replace(/\/+$/, "");
  const apiKey = $("apiKey").value.trim();
  if (!apiBase || !apiKey) {
    setStatus("Enter URL and key first", "err");
    return;
  }
  setStatus("Testing…");
  try {
    const res = await fetch(`${apiBase}/api/jobs/applied`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url: "https://example.com/__connection-test__" }),
    });
    if (res.status === 401) {
      setStatus("API key rejected", "err");
    } else if (res.status === 404 || res.status === 400) {
      // Auth passed but URL not in DB — that's the expected happy path.
      setStatus("Connected", "ok");
    } else if (res.ok) {
      setStatus("Connected", "ok");
    } else {
      setStatus(`Unexpected status ${res.status}`, "err");
    }
  } catch (e) {
    setStatus(e?.message || "Request failed", "err");
  }
});

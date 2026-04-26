const $ = (id) => document.getElementById(id);

chrome.storage.sync.get(["apiBase", "apiKey"], (cfg) => {
  const ok = !!(cfg.apiBase && cfg.apiKey);
  $("cfgDot").className = "dot " + (ok ? "ok" : "warn");
  $("cfgLabel").textContent = ok ? "Connected" : "Not configured";
  $("cfgSub").textContent = ok ? cfg.apiBase.replace(/^https?:\/\//, "") : "Open settings to add API base + key";
});

$("opts").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

$("open").addEventListener("click", async () => {
  const cfg = await new Promise((r) => chrome.storage.sync.get(["apiBase"], r));
  const target = cfg.apiBase ? `${cfg.apiBase.replace(/\/+$/, "")}/dashboard` : "https://vercel.com";
  chrome.tabs.create({ url: target });
});

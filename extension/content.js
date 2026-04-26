// Content script: runs on Ashby/Greenhouse/Lever postings.
// Detects an application-confirmation state, derives the canonical posting URL,
// and asks the background worker to call POST /api/jobs/applied.
//
// Detection per ATS:
//   - Lever:      URL ends with /thanks  → confirmed
//   - Ashby:      Apply URL .../application + body contains a "thank you" / "received" marker
//   - Greenhouse: URL contains gh_src + token query, OR body contains a confirmation marker
// Once we fire for a given URL we mark it sent so we don't double-fire on hash changes.

(() => {
  const FIRED_KEY = "__jobtrackerFired";
  if (window[FIRED_KEY]) return;

  const CONFIRMATION_MARKERS = [
    /thank(s| you) for (applying|your application)/i,
    /your application (has been )?(been )?(received|submitted)/i,
    /application (received|submitted|complete)/i,
    /we(?:'ve| have) received your application/i,
    /we(?:'ll| will) be in touch/i,
  ];

  function getHost() {
    return location.hostname.toLowerCase();
  }

  function isLever() {
    return getHost() === "jobs.lever.co";
  }
  function isAshby() {
    return getHost().endsWith("ashbyhq.com");
  }
  function isGreenhouse() {
    return getHost() === "boards.greenhouse.io" || getHost() === "job-boards.greenhouse.io";
  }

  function canonicalUrl() {
    const u = new URL(location.href);
    u.hash = "";
    u.search = "";
    let p = u.pathname.replace(/\/+$/, "");
    p = p
      .replace(/\/application$/i, "")
      .replace(/\/apply$/i, "")
      .replace(/\/thanks$/i, "")
      .replace(/\/confirmation$/i, "");
    u.pathname = p;
    return u.toString();
  }

  function bodyText() {
    return (document.body?.innerText || "").slice(0, 8000);
  }

  function bodyHasMarker() {
    const text = bodyText();
    return CONFIRMATION_MARKERS.some((rx) => rx.test(text));
  }

  function leverConfirmed() {
    return /\/thanks(\/|$)/.test(location.pathname) || bodyHasMarker();
  }

  function ashbyConfirmed() {
    if (!/\/application(\/|$)/.test(location.pathname)) return false;
    return bodyHasMarker();
  }

  function greenhouseConfirmed() {
    const url = new URL(location.href);
    const hasTokens = url.searchParams.has("gh_src") || url.searchParams.has("token");
    return (hasTokens && bodyHasMarker()) || bodyHasMarker();
  }

  function detect() {
    if (isLever()) return leverConfirmed();
    if (isAshby()) return ashbyConfirmed();
    if (isGreenhouse()) return greenhouseConfirmed();
    return false;
  }

  let debounceTimer = null;
  function maybeFire() {
    if (window[FIRED_KEY]) return;
    if (!detect()) return;
    window[FIRED_KEY] = true;
    const url = canonicalUrl();
    chrome.runtime.sendMessage({ type: "JT_MARK_APPLIED", url }, (resp) => {
      // ignore — background handles notification
      void resp;
      void chrome.runtime.lastError;
    });
  }

  function scheduleCheck() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(maybeFire, 600);
  }

  // Initial pass + react to SPA navigation / dynamic confirmation rendering.
  scheduleCheck();
  const mo = new MutationObserver(scheduleCheck);
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  window.addEventListener("popstate", scheduleCheck);
  window.addEventListener("hashchange", scheduleCheck);
})();

# Step 6 Design: Vercel Blob PDF Snapshots

**Date:** 2026-04-26
**Status:** Ready for review

---

## Decisions to Confirm

**1. Vercel Blob vs. Cloudflare R2 vs. self-hosted**

Recommended: **Vercel Blob.** One env var (`BLOB_READ_WRITE_TOKEN`), zero SDK quirks, integrated with the Vercel deployment where the token is auto-injected. Free tier covers 1 GB storage and 10 GB egress — far beyond what a job tracker generates running daily for years. Storage logic is fully encapsulated in `snapshot.ts`, so swapping to R2 later is a one-file change.

**2. PDF rendering location: scraper vs. dedicated API route**

Recommended: **scraper.** Playwright is already a scraper dependency and GitHub Actions ubuntu-latest has Chromium preinstalled. Offloading to a web/ API route would add an unnecessary HTTP round-trip and require a Vercel function with a high timeout budget.

**3. One shared browser instance vs. per-job browser launch**

Recommended: **one shared browser per scraper run, new `BrowserContext` per job.** Per-job browser launch costs 2–5 s startup each. A shared browser keeps startup overhead to a single hit while maintaining per-page isolation.

**4. PDF render parameters**

A4, no header/footer, `printBackground: true`, 30 s `page.pdf()` timeout. Navigation: `page.goto(url, { timeout: 15_000, waitUntil: "domcontentloaded" })`, then best-effort 5 s `waitForLoadState("networkidle")` (errors swallowed). ATS pages often fire analytics XHRs indefinitely — `domcontentloaded` is the reliable gate; networkidle is opportunistic.

**5. What if `BLOB_READ_WRITE_TOKEN` is not set**

Skip the entire snapshot pass with a single warning log; all jobs continue with `snapshotUrl: null`. Scraper still completes and ingests. Means the scraper works in a fresh dev checkout without Blob configuration.

**6. Naming / path scheme**

`snapshots/{source}/{hash16}.pdf` where `hash16` is the first 16 hex chars of `SHA-256(url)`. Deterministic, collision-resistant for this volume, no PII. `allowOverwrite: true` so re-runs overwrite cleanly.

**7. Re-upload efficiency**

Re-uploading a PDF that already exists in Blob is accepted for v1. A pre-check could be added later once volume grows.

**8. Concurrency**

Bound to `pLimit(3)` — separate from the `pLimit(5)` used for per-org JSON fetching. Limits peak browser memory to ~3 concurrent pages.

---

## Overview

Step 6 adds a snapshot pass to the scraper pipeline that runs **after** `filterJobs()` and **before** `ingestJobs()`. For each filtered job, render the URL to PDF via Playwright, upload to Vercel Blob with public access, set `job.snapshotUrl` to the returned CDN URL. Per-job failures leave `snapshotUrl: null` and never abort the batch.

`JobRecord.snapshotUrl` widens from `null` to `string | null`.

---

## Architecture

```
index.ts main()
  ├── scrape* → dedupe → filterJobs()       [Step 5]
  ├── snapshotJobs(filtered)                [NEW Step 6]
  │     ├── guard: BLOB_READ_WRITE_TOKEN missing → warn + return jobs unchanged
  │     ├── if jobs.length === 0 → return early
  │     ├── chromium.launch({ headless: true, args: ["--no-sandbox"] })
  │     ├── pLimit(3) over jobs:
  │     │     context = browser.newContext()
  │     │     try {
  │     │       page = context.newPage()
  │     │       page.goto(url, { timeout: 15_000, waitUntil: "domcontentloaded" })
  │     │       page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {})
  │     │       pdf = page.pdf({ format: "A4", printBackground: true, timeout: 30_000 })
  │     │       result = put(`snapshots/${source}/${hash16(url)}.pdf`, pdf, {
  │     │         access: "public", contentType: "application/pdf",
  │     │         allowOverwrite: true, token,
  │     │       })
  │     │       job.snapshotUrl = result.url
  │     │     } catch (err) { warn; snapshotUrl stays null }
  │     │     finally { context.close().catch(() => {}) }
  │     └── browser.close() (in finally)
  └── ingestJobs(snapshotted)               [unchanged]
```

---

## Module: `scraper/src/utils/snapshot.ts`

Exports `snapshotJobs(jobs: JobRecord[]): Promise<JobRecord[]>`.

- Guard on `BLOB_READ_WRITE_TOKEN`; if missing, warn once + return jobs unmodified.
- Empty array → early return (no browser launched).
- Single shared browser, separate `BrowserContext` per job for isolation.
- `pLimit(3)` for concurrent rendering.
- `hash16(url)` = `createHash("sha256").update(url).digest("hex").slice(0, 16)`.
- Mutates `job.snapshotUrl`; returns same array.
- Logs `[snapshot] url → blobUrl` on success; `[snapshot] WARN url failed: reason` on error.
- Browser launched with `args: ["--no-sandbox", "--disable-setuid-sandbox"]` for CI compatibility.

---

## File Map

**Created:**

| File | Responsibility |
|---|---|
| `scraper/src/utils/snapshot.ts` | `snapshotJobs()` — Playwright + Vercel Blob |
| `scraper/src/utils/snapshot.test.ts` | Unit tests + live-gated test |

**Modified:**

| File | Change |
|---|---|
| `scraper/src/types.ts` | `snapshotUrl: null` → `snapshotUrl: string \| null` |
| `scraper/src/index.ts` | Insert `snapshotJobs` call between `filterJobs` and `ingestJobs` |
| `scraper/package.json` | Add `"@vercel/blob": "^2.3.3"` |
| `CLAUDE.md` | Replace R2 env vars with `BLOB_READ_WRITE_TOKEN`; mark Step 6 `[x]` |

The three scrapers (`ashby.ts`, `greenhouse.ts`, `lever.ts`) need no changes — `snapshotUrl: null` already satisfies `string | null`.

---

## Error Handling

| Condition | Behavior |
|---|---|
| `BLOB_READ_WRITE_TOKEN` not set | warn + return jobs unchanged |
| `jobs.length === 0` | early return, no browser launched |
| Browser launch fails | error + rethrow (fatal — usually missing Chromium) |
| `page.goto` timeout / nav error | catch per-job, warn, snapshotUrl stays null |
| `waitForLoadState` timeout | swallowed — render continues |
| `page.pdf()` timeout / crash | catch per-job, warn, snapshotUrl stays null |
| `context.close()` error | swallowed via `try/finally` |
| Blob `put()` network or auth error | catch per-job, warn, snapshotUrl stays null |
| All jobs fail | all snapshotUrl null, ingest proceeds normally |

Browser closed in outer `finally` so a mid-batch error never leaks the process handle.

---

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | No | — | Vercel Blob auth. If absent, snapshot pass is skipped |
| `SCRAPER_SNAPSHOT_LIVE_TEST` | No | — | Enables live-gated snapshot test |

---

## Testing Strategy

**Unit tests (`snapshot.test.ts`, 7 tests):**

Mock `playwright` (`chromium.launch` → fake browser/context/page chain) and `@vercel/blob` (`put` → returns fake `{url}`).

1. Empty array → no browser launch
2. Missing `BLOB_READ_WRITE_TOKEN` → no browser launch, snapshotUrl stays null
3. Successful render → snapshotUrl set to mocked URL
4. `page.goto` throws → snapshotUrl stays null
5. `put()` throws → snapshotUrl stays null
6. Browser always closed (verify `mockBrowser.close` called) even on per-job failure
7. `put()` called with correct pathname pattern + access + contentType + allowOverwrite

**Live-gated test (`SCRAPER_SNAPSHOT_LIVE_TEST=1`):**

Snapshot one real URL end-to-end, assert returned URL matches Vercel Blob CDN regex and HEAD returns 200.

---

## What This Step Does NOT Include

- No web UI for displaying snapshots — Step 10
- No retention policy or blob cleanup
- No re-snapshotting of old jobs with null snapshotUrl
- No OCR or text extraction from PDFs
- No skip-if-already-snapshotted optimization
- No GitHub Actions changes — Step 7
- No R2 integration — superseded by Vercel Blob

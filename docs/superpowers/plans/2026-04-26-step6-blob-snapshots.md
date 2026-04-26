# Step 6: Vercel Blob PDF Snapshots — Implementation Plan

**Goal:** Add a PDF snapshot pass to the scraper. After `filterJobs()` and before `ingestJobs()`, render each job URL to PDF via Playwright, upload to Vercel Blob (`snapshots/{source}/{hash16}.pdf`, public, allowOverwrite), set `job.snapshotUrl` to the returned CDN URL. Per-job errors leave `snapshotUrl: null`, never abort. If `BLOB_READ_WRITE_TOKEN` absent, skip pass entirely.

**Tech stack changes:**

| Package | Type | Purpose |
|---|---|---|
| `@vercel/blob` | dep (scraper) | Upload PDFs to Vercel Blob |

---

## Chunk 1: Install `@vercel/blob` + widen JobRecord type

### Task 1: Add dep, install, widen type

- [ ] **Step 1:** Add `"@vercel/blob": "^2.3.3"` to `scraper/package.json` dependencies.
- [ ] **Step 2:** `pnpm install` from repo root, exit 0.
- [ ] **Step 3:** Verify `pnpm --filter scraper exec node --input-type=module -e "import('@vercel/blob').then(m => console.log(typeof m.put))"` prints `function`.
- [ ] **Step 4:** In `scraper/src/types.ts` change `snapshotUrl: null` → `snapshotUrl: string | null`.
- [ ] **Step 5:** `pnpm --filter scraper exec tsc --noEmit` exit 0.
- [ ] **Step 6:** Commit: `feat(step6): add @vercel/blob dep + widen snapshotUrl type`.

---

## Chunk 2: Implement `snapshot.ts`

### Task 2: Create `scraper/src/utils/snapshot.ts`

- [ ] **Step 1:** Write the full module per design doc:

```typescript
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { put } from "@vercel/blob";
import pLimit from "p-limit";
import type { JobRecord } from "../types.js";

function hash16(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export async function snapshotJobs(jobs: JobRecord[]): Promise<JobRecord[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.warn("[snapshot] BLOB_READ_WRITE_TOKEN not set — skipping snapshot pass");
    return jobs;
  }
  if (jobs.length === 0) return jobs;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const limit = pLimit(3);

  try {
    await Promise.all(
      jobs.map((job) =>
        limit(async () => {
          const context = await browser.newContext();
          try {
            const page = await context.newPage();
            await page.goto(job.url, { timeout: 15_000, waitUntil: "domcontentloaded" });
            await page
              .waitForLoadState("networkidle", { timeout: 5_000 })
              .catch(() => {});
            const pdf = await page.pdf({
              format: "A4",
              printBackground: true,
              timeout: 30_000,
            });
            const pathname = `snapshots/${job.source}/${hash16(job.url)}.pdf`;
            const result = await put(pathname, pdf, {
              access: "public",
              contentType: "application/pdf",
              allowOverwrite: true,
              token,
            });
            job.snapshotUrl = result.url;
            console.log(`[snapshot] ${job.url} → ${result.url}`);
          } catch (err) {
            console.warn(`[snapshot] WARN ${job.url} failed: ${String(err)}`);
          } finally {
            await context.close().catch(() => {});
          }
        }),
      ),
    );
  } finally {
    await browser.close();
  }

  return jobs;
}
```

- [ ] **Step 2:** `pnpm --filter scraper exec tsc --noEmit` exit 0.
- [ ] **Step 3:** Commit.

---

## Chunk 3: Wire snapshotJobs into index.ts

### Task 3: Update `scraper/src/index.ts`

- [ ] **Step 1:** Add import at top: `import { snapshotJobs } from "./utils/snapshot.js";`.
- [ ] **Step 2:** Replace the gap between `filterJobs` and `ingestJobs` so it reads:

```typescript
  const filtered = filterJobs(deduped, { hoursWindow });
  console.log(
    `[scraper] merged=${all.length} deduped=${deduped.length} after-filter=${filtered.length}`,
  );

  if (filtered.length === 0) {
    console.log("[scraper] no jobs matched filters — nothing to ingest");
    process.exit(0);
  }

  const snapshotted = await snapshotJobs(filtered);
  const withSnapshots = snapshotted.filter((j) => j.snapshotUrl !== null).length;
  console.log(`[scraper] snapshots=${withSnapshots}/${snapshotted.length}`);

  const { sent, errors } = await ingestJobs(snapshotted);
```

- [ ] **Step 3:** `pnpm --filter scraper exec tsc --noEmit` exit 0.
- [ ] **Step 4:** Commit.

---

## Chunk 4: Vitest tests

### Task 4: Create `scraper/src/utils/snapshot.test.ts`

- [ ] **Step 1:** Write tests with mocked Playwright + mocked `@vercel/blob` per design (7 unit tests + 1 live-gated). Use dynamic `import("./snapshot.js")` inside each test so env-var changes take effect before module evaluation.
- [ ] **Step 2:** `pnpm --filter scraper test` — all unit tests pass, live skip.
- [ ] **Step 3:** Commit.

---

## Chunk 5: Final Verification

### Task 5: Typecheck, tests, CLAUDE.md, commit

- [ ] **Step 1:** `pnpm --filter scraper exec tsc --noEmit` exit 0.
- [ ] **Step 2:** `pnpm --filter scraper test` all unit pass, live skip.
- [ ] **Step 3:** Update `CLAUDE.md`:
  - Remove the five `R2_*` lines from "Environment Variables Needed" and replace with `BLOB_READ_WRITE_TOKEN`.
  - Same for GitHub Actions Secrets block.
  - Mark Step 6 `[x]` in checklist.
- [ ] **Step 4:** `pnpm --filter web build` exit 0 (web/ unaffected).
- [ ] **Step 5:** Final commit: `feat: complete Step 6 — Vercel Blob PDF snapshots`.

---

## Verification Summary

| Check | Command | Expected |
|---|---|---|
| Install | `pnpm install` | `@vercel/blob` present |
| Typecheck | `pnpm --filter scraper exec tsc --noEmit` | exit 0 |
| Unit tests | `pnpm --filter scraper test` | 7 new pass, live skip |
| Live snapshot | `SCRAPER_SNAPSHOT_LIVE_TEST=1 BLOB_READ_WRITE_TOKEN=… pnpm --filter scraper test` | snapshotUrl set + HEAD 200 |
| Web build | `pnpm --filter web build` | exit 0 |

---

## What This Step Does NOT Include

- No web UI for snapshots — Step 10
- No GitHub Actions YAML changes — Step 7
- No retention or cleanup
- No OCR/text extraction
- No skip-if-already-snapshotted
- No web/ API changes (Zod already accepts `snapshotUrl: string | null`)

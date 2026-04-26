# Step 5: Scraper — Ashby, Greenhouse, Lever — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Node.js scraper under `scraper/` that fetches fresh SWE postings from Ashby, Greenhouse, and Lever via public JSON APIs, filters by age/location/title, and POSTs batches to `POST /api/jobs/ingest`. No Playwright rendering. No R2 snapshots. No GitHub Actions YAML. No web UI changes.

**Architecture:** Three JSON-API scrapers run via `Promise.allSettled` in parallel; results merged, deduped by URL, filtered, shipped in ≤200-record batches. `p-limit(5)` bounds per-org fetch concurrency. `tsx` replaces `ts-node` for faster cold-start. Vitest covers filter + ingest unit tests; live-gated tests cover one real org per ATS.

**Tech stack changes to `scraper/package.json`:**

| Package | Type | Change |
|---|---|---|
| `tsx` | devDep | Replace `ts-node` |
| `p-limit` | dep | Per-org fetch concurrency |
| `vitest` | devDep | Test runner |

---

## Chunk 1: Package Setup

### Task 1: Update `scraper/package.json`, create `tsconfig.json` and `vitest.config.ts`

- [ ] **Step 1:** Replace `scraper/package.json`:
  ```json
  {
    "name": "scraper",
    "version": "0.0.1",
    "private": true,
    "type": "module",
    "scripts": {
      "start": "tsx src/index.ts",
      "test": "vitest run",
      "test:live": "SCRAPER_LIVE_TEST=1 vitest run"
    },
    "dependencies": {
      "p-limit": "^6.2.0",
      "playwright": "^1.40.0"
    },
    "devDependencies": {
      "@types/node": "^20.0.0",
      "tsx": "^4.19.0",
      "typescript": "^5.0.0",
      "vitest": "^2.1.0"
    }
  }
  ```
- [ ] **Step 2:** Create `scraper/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "node16",
      "moduleResolution": "node16",
      "esModuleInterop": true,
      "strict": true,
      "skipLibCheck": true,
      "outDir": "dist",
      "rootDir": "src"
    },
    "include": ["src/**/*"]
  }
  ```
- [ ] **Step 3:** Create `scraper/vitest.config.ts`:
  ```typescript
  import { defineConfig } from "vitest/config";
  export default defineConfig({
    test: { environment: "node" },
  });
  ```
- [ ] **Step 4:** `pnpm install` from repo root, exit 0.
- [ ] **Step 5:** `pnpm --filter scraper exec tsx --version` prints version.
- [ ] **Step 6:** Commit: `feat(step5): scraper package setup — tsx, p-limit, vitest`.

---

## Chunk 2: Shared Types + Org Slug List

### Task 2: Create `types.ts` and `orgs.ts`

- [ ] **Step 1:** Create `scraper/src/types.ts`:
  ```typescript
  export type JobSource = "ashby" | "greenhouse" | "lever";

  export interface JobRecord {
    url: string;
    title: string;
    company: string;
    location: string;
    description: string | null;
    source: JobSource;
    postedAt: string; // ISO 8601
    snapshotUrl: null;
  }
  ```
- [ ] **Step 2:** Create `scraper/src/orgs.ts` with the three slug arrays and `orgToCompany(slug)` helper. Hardcoded company name map for known special-cased slugs (e.g. `scale-ai` → `Scale AI`, `openai` → `OpenAI`, `pylon-labs` → `Pylon`, `nyc` → `NYC`). Fallback for unmapped: title-case the slug.
- [ ] **Step 3:** `pnpm --filter scraper exec tsc --noEmit` exit 0.
- [ ] **Step 4:** Commit.

---

## Chunk 3: Filter Utility

### Task 3: Create `scraper/src/utils/filter.ts`

- [ ] **Step 1:** Export `LOCATION_PATTERNS: RegExp[]`, `TITLE_PATTERNS: RegExp[]`, `FilterOptions { hoursWindow }`, and `filterJobs(jobs, opts)`. Logic: skip if `isNaN(timestamp)` or older than cutoff or no location pattern matches or no title pattern matches.
- [ ] **Step 2:** tsc exit 0.
- [ ] **Step 3:** Commit.

---

## Chunk 4: Ingest Client

### Task 4: Create `scraper/src/utils/ingest.ts`

- [ ] **Step 1:** Implement `ingestJobs(jobs)` per design: empty-array guard, chunk to 200, POST each chunk with bearer auth, accumulate `sent`/`errors`. `postBatch` catches HTTP errors and network errors separately, logs both.
- [ ] **Step 2:** tsc exit 0.
- [ ] **Step 3:** Commit.

---

## Chunk 5: Ashby Scraper

### Task 5: Create `scraper/src/scrapers/ashby.ts`

- [ ] **Step 1:** `fetchOrgAshby(org)` calls `https://api.ashbyhq.com/posting-api/job-board/${org}` with 10s timeout, filters `isListed === true && publishedAt`, maps to `JobRecord`. `scrapeAshby()` runs `pLimit(5)` over `ASHBY_ORGS`, flattens.
- [ ] **Step 2:** tsc exit 0.
- [ ] **Step 3:** Commit.

---

## Chunk 6: Greenhouse Scraper

### Task 6: Create `scraper/src/scrapers/greenhouse.ts`

- [ ] **Step 1:** Analogous to Ashby, with `https://boards-api.greenhouse.io/v1/boards/${org}/jobs?content=true`. Includes `stripHtml(html)` helper that returns `null` for empty result. Filter `j.updated_at` truthy.
- [ ] **Step 2:** tsc exit 0.
- [ ] **Step 3:** Commit.

---

## Chunk 7: Lever Scraper

### Task 7: Create `scraper/src/scrapers/lever.ts`

- [ ] **Step 1:** Analogous; `https://api.lever.co/v0/postings/${org}?mode=json`. Response is an array. Filter `createdAt > 0`. Convert epoch ms to ISO.
- [ ] **Step 2:** tsc exit 0.
- [ ] **Step 3:** Commit.

---

## Chunk 8: Entry Point

### Task 8: Replace `scraper/src/index.ts`

- [ ] **Step 1:** Implement `main()` per design: validate env, parse window, `Promise.allSettled`, log per-ATS, merge, dedupe, filter, `ingestJobs`, summary, exit 0. Top-level `.catch()` logs and exits 1.
- [ ] **Step 2:** tsc exit 0.
- [ ] **Step 3:** Commit.

---

## Chunk 9: Vitest Tests

### Task 9: Unit + live-gated tests

- [ ] **Step 1:** `scraper/src/utils/filter.test.ts` — 16 tests across age (3) / location (5) / title (7) / combined (1). Use `makeJob(overrides)` helper.
- [ ] **Step 2:** `scraper/src/utils/ingest.test.ts` — 6 tests: empty noop, single batch, 250→2 chunks, non-2xx, network error, auth header. Mock fetch via `vi.stubGlobal("fetch", ...)`.
- [ ] **Step 3:** `scraper/src/scrapers/{ashby,greenhouse,lever}.test.ts` — each one `describe.skipIf(!process.env.SCRAPER_LIVE_TEST)` with assertions: `length > 0`, `url` matches `^https://`, correct `source`, `postedAt` matches ISO.
- [ ] **Step 4:** `pnpm --filter scraper test` — 22 unit pass, 3 live skip.
- [ ] **Step 5:** Commit.

---

## Chunk 10: Final Verification

### Task 10: Typecheck, tests, smoke run, CLAUDE.md update

- [ ] **Step 1:** `pnpm --filter scraper exec tsc --noEmit` exit 0.
- [ ] **Step 2:** `pnpm --filter scraper test` all unit pass, live skip.
- [ ] **Step 3:** (Optional) Network smoke run with web/ running locally.
- [ ] **Step 4:** `pnpm --filter web build` still exits 0.
- [ ] **Step 5:** Mark Step 5 `[x]` in `CLAUDE.md`.
- [ ] **Step 6:** Final commit.

---

## Verification Summary

| Check | Command | Expected |
|---|---|---|
| Install | `pnpm install` | tsx + p-limit present |
| Typecheck | `pnpm --filter scraper exec tsc --noEmit` | exit 0 |
| Unit tests | `pnpm --filter scraper test` | 22 pass, 3 skip |
| Live tests | `SCRAPER_LIVE_TEST=1 pnpm --filter scraper test` | ≥1 result/ATS |
| Web build | `pnpm --filter web build` | exit 0 |

---

## What This Step Does NOT Include

- No R2 PDF snapshots — Step 6
- No GitHub Actions workflow YAML — Step 7
- No web UI or new API routes
- No Gmail integration
- No Playwright invocation — dep present, not called
- No per-user org slug customization — Step 8

# Step 5 Design: Scraper — Ashby, Greenhouse, and Lever

**Date:** 2026-04-26
**Status:** Ready for review

---

## Decisions to Confirm

**1. JSON API vs. Playwright**

Recommended: **JSON API first, Playwright as fallback only.** Ashby, Greenhouse, and Lever all publish unauthenticated public JSON endpoints for their job boards. Using `fetch` avoids any Chromium dependency on local runs, makes tests fast and offline-capable, and means the scraper completes in seconds rather than minutes. Playwright is installed as a dep (GitHub Actions ubuntu-latest has Chromium preinstalled) but is only invoked from a fallback path when the JSON API returns a non-200 or malformed response. For v1, the fallback is a `// TODO: Playwright fallback` comment — it is not implemented.

**2. Hardcoded org slug list vs. auto-discovery**

Recommended: **single hardcoded `scraper/src/orgs.ts`** with 50 slugs split across the three ATSes. Auto-discovery via search-engine scraping is brittle, rate-limited, and slow. Future Step 8 (Settings page) adds a per-user DB-backed org list; `orgs.ts` becomes the system-wide default.

**3. Title filter aggressiveness**

Recommended: **allowlist regex, case-insensitive.** Matches `software engineer`, `backend`, `frontend`, `full-?stack`, `sre`, `site reliability`, `devops`, `platform engineer`, `ml engineer`, `machine learning engineer`, `data engineer`, `infrastructure engineer`. Niche titles like "Member of Technical Staff" will be missed — acceptable false-negative for v1.

**4. 24h window: `postedAt` from ATS vs. `firstSeenAt` from DB**

Recommended: **`postedAt` from the ATS response.** Self-contained scraper, no DB reads. Jobs with missing/unparseable timestamps are **skipped**. Window configurable via `SCRAPER_HOURS_WINDOW` (default 24). For Greenhouse, `updated_at` proxies as `postedAt` since the API has no true `posted_at`.

**5. One-shot vs. long-running process**

Recommended: **one-shot.** Run, complete, exit. GitHub Actions invokes on cron in Step 7.

---

## Overview

Step 5 delivers a standalone Node.js scraper that fetches fresh SWE jobs from Ashby, Greenhouse, and Lever via public JSON APIs, filters by age (<24h), US/Remote location, and SWE-ish title, then POSTs batches of up to 200 records to `POST /api/jobs/ingest` (Step 4).

Lives entirely under `scraper/`. Produces `JobRecord`-shaped objects matching `web/app/api/jobs/ingest/schema.ts`. `snapshotUrl` is always `null` (Step 6 fills it).

---

## Architecture

```
index.ts
  ├── validate env: VERCEL_URL + INGEST_BEARER_TOKEN required → exit 1 if missing
  ├── Promise.allSettled([scrapeAshby(), scrapeGreenhouse(), scrapeLever()])
  │     each: pLimit(5) over org slugs → fetch JSON → map to JobRecord[]
  ├── merge fulfilled results → dedupe by URL (Map)
  ├── filterJobs(deduped, { hoursWindow })
  ├── chunk into ≤200, POST to /api/jobs/ingest with Bearer auth
  └── print summary, exit 0
```

**Per-ATS error isolation.** `Promise.allSettled` ensures one ATS failure doesn't abort the others. **In-process URL dedup** before POST reduces payload size. **`p-limit(5)`** bounds per-org concurrency. **`AbortSignal.timeout(10_000)`** prevents hung connections. **`tsx`** replaces `ts-node` for faster execution.

---

## ATS API Contracts

### Ashby

`GET https://api.ashbyhq.com/posting-api/job-board/{orgSlug}` returns `{ jobs: [...] }`.

| ATS field | JobRecord field | Notes |
|---|---|---|
| `title` | `title` | |
| `publishedAt` | `postedAt` | Skip if null |
| `jobUrl` | `url` | |
| `location` (fallback `workplaceType`) | `location` | |
| `descriptionPlain` | `description` | |
| Hardcoded per slug | `company` | API doesn't return company name |
| `"ashby"` | `source` | |
| `null` | `snapshotUrl` | Step 6 |

Filter `isListed === true` before mapping.

### Greenhouse

`GET https://boards-api.greenhouse.io/v1/boards/{boardToken}/jobs?content=true` returns `{ jobs: [...] }`.

| ATS field | JobRecord field | Notes |
|---|---|---|
| `title` | `title` | |
| `updated_at` | `postedAt` | Proxy — no `posted_at` exists |
| `absolute_url` | `url` | |
| `location.name` | `location` | |
| `content` (HTML-stripped) | `description` | |
| Hardcoded per slug | `company` | |
| `"greenhouse"` | `source` | |

`updated_at` may resurface old recently-edited jobs — deduped by URL on next run.

### Lever

`GET https://api.lever.co/v0/postings/{orgSlug}?mode=json` returns array directly.

| ATS field | JobRecord field | Notes |
|---|---|---|
| `text` | `title` | Lever calls title `text` |
| `new Date(createdAt).toISOString()` | `postedAt` | createdAt is epoch ms |
| `hostedUrl` | `url` | |
| `categories.location` | `location` | |
| `descriptionPlain` | `description` | |
| Hardcoded per slug | `company` | |
| `"lever"` | `source` | |

---

## Org Slug List (`scraper/src/orgs.ts`)

50 curated slugs. A 404 from any slug is logged and skipped, never aborts the run.

```
ASHBY_ORGS (18):
  linear, ramp, retool, vanta, harvey, notion, brex, rippling, figma, vercel,
  anthropic, scale-ai, openai, confluent, checkout.com, traba, zapier, pylon-labs

GREENHOUSE_ORGS (17):
  stripe, airbnb, pinterest, reddit, doordash, coinbase, robinhood, lyft, twilio,
  zendesk, squarespace, hubspot, flexport, duolingo, plaid, mongodb, datadog

LEVER_ORGS (15):
  palantir, netflix, atlassian, shopify, coursera, asana, okta, cloudflare,
  elastic, replit, benchling, expensify, carta, captivateiq, voleon
```

`orgToCompany(slug)`: hardcoded map for proper casing (`scale-ai` → `Scale AI`, `openai` → `OpenAI`, etc.); falls back to title-casing the slug.

---

## Filter Logic (`scraper/src/utils/filter.ts`)

**Age:** `new Date(postedAt).getTime() >= Date.now() - hoursWindow * 3_600_000`. Skip if `isNaN`.

**Location allowlist (case-insensitive RegExp[]):**
```
/\bremote\b/i, /\b(?:us|usa)\b/i, /united\s+states/i, /north\s+america/i,
/new\s+york/i, /\bnyc\b/i, /san\s+francisco/i, /\bsf\b/i, /bay\s+area/i,
/\baustin\b/i, /\bseattle\b/i, /\bboston\b/i, /\bchicago\b/i,
/\bdenver\b/i, /\batlanta\b/i, /los\s+angeles/i
```

Empty location string fails. "London, UK" fails. "Anywhere" fails.

**Title allowlist:**
```
/software\s+engineer/i, /\bbackend\b/i, /\bfrontend\b/i, /front[\s-]?end/i,
/full[\s-]?stack/i, /\bsre\b/i, /site\s+reliability/i, /\bdevops\b/i,
/platform\s+engineer/i, /\bml\s+engineer\b/i, /machine\s+learning\s+engineer/i,
/data\s+engineer/i, /infrastructure\s+engineer/i
```

---

## Ingest Client (`scraper/src/utils/ingest.ts`)

```typescript
export interface IngestResult { sent: number; errors: number; }
export async function ingestJobs(jobs: JobRecord[]): Promise<IngestResult>
```

- Empty array → `{sent:0, errors:0}` no-op.
- Chunks into ≤200; POSTs each to `${VERCEL_URL}/api/jobs/ingest` with `Authorization: Bearer ${INGEST_BEARER_TOKEN}`.
- Non-2xx logs status+body, increments `errors`, continues.
- Network error caught, increments `errors`, continues.

---

## Entry Point (`scraper/src/index.ts`)

1. Validate `VERCEL_URL` + `INGEST_BEARER_TOKEN` → exit 1 if missing.
2. Parse `SCRAPER_HOURS_WINDOW` (default 24).
3. `Promise.allSettled` over three scrapers.
4. Log per-ATS results, merge fulfilled.
5. Dedupe by URL.
6. Filter.
7. `ingestJobs(filtered)`.
8. Print summary, exit 0.

---

## File Map

**Created:**

| File | Responsibility |
|---|---|
| `scraper/src/types.ts` | `JobRecord` + `JobSource` |
| `scraper/src/orgs.ts` | Slug lists + `orgToCompany()` |
| `scraper/src/utils/filter.ts` | `filterJobs()` + patterns |
| `scraper/src/utils/ingest.ts` | `ingestJobs()` |
| `scraper/src/scrapers/{ashby,greenhouse,lever}.ts` | Per-ATS scrapers |
| `scraper/src/index.ts` | Entry point |
| `scraper/vitest.config.ts` | Vitest config |
| `scraper/src/utils/{filter,ingest}.test.ts` | Unit tests |
| `scraper/src/scrapers/{ashby,greenhouse,lever}.test.ts` | Live-gated tests |

**Modified:**

| File | Change |
|---|---|
| `scraper/package.json` | Replace `ts-node` with `tsx`; add `p-limit`, `vitest`; `"type": "module"` |
| `scraper/tsconfig.json` | `ES2022`, `node16` module resolution, `strict: true` |

---

## Error Handling

| Condition | Behavior |
|---|---|
| Missing required env | stderr + exit 1 |
| Per-org HTTP non-200 | warn, return `[]`, continue |
| Per-org network error | warn, return `[]`, continue |
| ATS-level throw | caught by allSettled, logged, empty array |
| Job missing/bad timestamp | skip silently |
| Ingest batch error | log, increment errors, continue |
| All ATSes fail | empty array → exit 0 (no fatal) |

After successful env validation, scraper always exits 0 — transient failures don't break GitHub Actions runs.

---

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `VERCEL_URL` | Yes | — | Base URL for ingest endpoint |
| `INGEST_BEARER_TOKEN` | Yes | — | Must match value in Vercel/web/.env |
| `SCRAPER_HOURS_WINDOW` | No | `24` | Age filter window |
| `SCRAPER_LIVE_TEST` | No | — | Enables live ATS tests in vitest |

---

## Testing Strategy

**Unit tests (always run):**

`filter.test.ts` — 16 tests: age (3), location (5), title (7), combined (1).

`ingest.test.ts` — 6 tests: empty noop, single batch, chunking at 200, HTTP error, network error, auth header.

**Live-gated tests (`SCRAPER_LIVE_TEST=1`):**

One per ATS — fetches one known-good org (linear/stripe/palantir), asserts ≥1 result with valid url + source.

---

## What This Step Does NOT Include

- No R2 PDF snapshots — Step 6
- No GitHub Actions workflow YAML — Step 7
- No web UI changes
- No Gmail integration
- No Playwright invocation — dep installed, fallback path commented but not implemented
- No per-user org slug customization — Step 8

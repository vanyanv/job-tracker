# Brave-Search Discovery + Rich Filters + Job Detail Panel

**Date:** 2026-04-27
**Status:** Design approved, ready for implementation plan

## Context

The job-tracker currently ingests jobs via three direct-API scrapers (Ashby, Greenhouse, Lever) keyed off curated org lists. Discovery is bottlenecked by that org list — any company not pre-listed never lands in the feed. Filtering is also thin: status, score-threshold, and a text query against title/company. Rows link straight to the external apply URL, so users have to leave the app to see what a job actually entails.

This change adds:

1. A second discovery lane that runs Brave Search against the three ATS domains, dramatically widening coverage without sacrificing the structured data the ATS APIs provide (Brave finds the URL; we still hit the ATS API to enrich it).
2. AI tagging at ingest, extracting level, salary range, minimum years-of-experience, tech-stack tags, work-mode, and a cleaned location — turning the messy free-text fields into real filterable facets.
3. A filter bar and saved-searches strip on the dashboard so users can slice the job pool by level, work-mode, location, posted-within, salary, YoE, stack, and company.
4. A slide-in side panel for the job detail surface so users can read the description and triage without leaving the feed.
5. Per-user "hidden companies" so jobs from blocked companies auto-skip at ingest.
6. A freshness dot per row.

Goal: make the feed the primary read surface (not just a launcher), and make a backlog of 200+ jobs triageable in minutes rather than hours.

## Architecture

Two ingestion lanes feed the same `Job` table. After upsert, a new global AI-tagging step runs once per new job, then the existing per-user scoring loop runs unchanged.

```
Lane A (existing):  Ashby/Greenhouse/Lever org-list scrapers
Lane B (new):       Brave Search → URL classifier → per-ATS fetchOne()

  both → JobRecord[] → /api/jobs/ingest
                          ├─ upsert Job (dedup by URL)
                          ├─ NEW: AI-tag each new job (system Groq key)
                          ├─ existing per-user scoring loop
                          └─ create UserJob (NEW: auto-skip if hidden company)
```

Brave quota math: 3 role-keyword queries × 12 cycles/day = ~1,080/mo, well under Brave's 2k/mo free tier.

## Schema Changes

`web/prisma/schema.prisma`:

**`Job` — new columns** (all nullable until tagging completes):

| Column | Type | Notes |
|---|---|---|
| `level` | enum (`intern`, `junior`, `mid`, `senior`, `staff`, `principal`, `manager`, `director`, `unknown`) | AI-extracted |
| `workMode` | enum (`remote`, `hybrid`, `onsite`, `unknown`) | AI-extracted |
| `locationCity` | String? | "New York, NY" |
| `locationCountry` | String? | "US", "CA", … |
| `salaryMin` | Int? | USD |
| `salaryMax` | Int? | USD |
| `minYoE` | Int? | Years |
| `stackTags` | String[] | Lowercased, normalized |
| `taggedAt` | DateTime? | Null = pending |
| `tagModel` | String? | For re-tag invalidation |

Indexes: `postedAt`, `level`, `workMode`, `locationCountry`, composite `(level, workMode, postedAt)`, GIN on `stackTags`.

**New `SavedSearch` model:**
```prisma
model SavedSearch {
  id        String   @id @default(cuid())
  userId    String
  name      String
  filters   Json     // matches feed query-param shape
  sortIndex Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, sortIndex])
}
```

**`User` — new column:** `hiddenCompanies String[] @default([])` (lowercased, suffix-stripped).

**`UserJob` — new column:** `autoSkippedReason String?` — e.g. `"hidden_company"`.

No backfill migration needed for existing jobs; they'll display with `level=null` until a one-shot tagger pass runs.

## Brave Search Lane

**New file:** `scraper/src/scrapers/brave.ts`

```ts
async function runBraveLane(config) {
  const queries = config.queries.map(role =>
    `${role} (site:ashbyhq.com OR site:boards.greenhouse.io OR site:jobs.lever.co)`
  )

  for (const q of queries) {
    const results = await braveSearch({ q, freshness: "pd", count: 20, country: "us" })
    for (const r of results) {
      const ats = classifyUrl(r.url)         // "ashby" | "greenhouse" | "lever" | null
      if (!ats) continue
      const job = await fetchOneFromAts(ats, r.url) ?? fallbackFromSnippet(r)
      if (job) emit(job)
    }
  }
}
```

**Refactor existing scrapers** (`scraper/src/scrapers/{ashby,greenhouse,lever}.ts`) to expose `fetchOne(url)` helpers alongside the bulk fetchers:

- Ashby: `https://jobs.ashbyhq.com/{org}/{jobId}` → `https://api.ashbyhq.com/posting-api/job-board/{org}` (find by jobId).
- Greenhouse: `https://boards.greenhouse.io/{org}/jobs/{jobId}` → `https://boards-api.greenhouse.io/v1/boards/{org}/jobs/{jobId}?content=true`.
- Lever: `https://jobs.lever.co/{org}/{jobId}` → `https://api.lever.co/v0/postings/{org}/{jobId}?mode=json`.

**New util:** `scraper/src/utils/brave.ts` — Brave API wrapper with retry + 429 backoff.

**Orchestration:** `scraper/src/index.ts` runs both lanes via `Promise.allSettled`. Existing dedup-by-URL handles overlap.

**New env:** `BRAVE_SEARCH_API_KEY`, `SEARCH_QUERIES_JSON` (default `["software engineer","frontend engineer","backend engineer"]`).

## AI Tagging at Ingest

**New file:** `web/lib/ai/tagger.ts` — system-level tagger using a single shared Groq key (separate from per-user `aiApiKey`).

Single JSON-mode Groq call per new job; returns Zod-validated:
```ts
{
  level, workMode,
  locationCity, locationCountry,
  salaryMin, salaryMax,    // USD, nullable
  minYoE,                  // nullable
  stackTags: string[],     // max 8, lowercased
}
```

`stackTags` are mapped through a small alias table (`react.js → react`, `nodejs → node`, `golang → go`, …) so the GIN index is dense.

**Where it runs:** `web/app/api/jobs/ingest/route.ts`, after the upsert loop and before the per-user scoring loop:
```ts
const newJobs = upserted.filter(u => u.isNewlyCreated)
await pLimit(3)(newJobs.map(tagJobAndUpdate))   // ~1–2s/job
```

**Failure handling:** on tagger error, leave `taggedAt=null`. Next ingest cycle re-attempts untagged jobs. Job still appears in feed; just lacks structured filter fields.

**Backfill:** one-shot `web/scripts/backfill-tags.ts` walks untagged jobs in batches of 100 (Groq free tier is 14,400 req/day).

**New env:** `SYSTEM_AI_PROVIDER` (default `"groq"`), `SYSTEM_AI_API_KEY`.

## Hide-Companies Enforcement

**At ingest** (in the UserJob-creation pass): if `normalize(job.company) ∈ user.hiddenCompanies`, set `status="skipped"` + `autoSkippedReason="hidden_company"`. `normalize` lowercases, trims, strips `, Inc.` / `LLC` / `Corp` suffixes.

**Retroactive hide** (when user adds a company): the API endpoint also runs an `UPDATE UserJob SET status='skipped', autoSkippedReason='hidden_company' WHERE userId=? AND status='new' AND jobId IN (SELECT id FROM Job WHERE LOWER(company)=?)` so the feed updates immediately.

**Un-hide** restores only those UserJobs whose `autoSkippedReason='hidden_company'` (never resurrects user-triaged skips).

**API routes:**
- `GET /api/users/me/hidden-companies`
- `POST /api/users/me/hidden-companies` `{ company }`
- `DELETE /api/users/me/hidden-companies/[company]`

## Feed API

`web/app/api/jobs/route.ts` — new optional query params (AND-combined):
- `level` (multi), `workMode` (multi), `source` (multi)
- `locationCountry`, `locationCity` (multi)
- `postedAfter`, `postedBefore` (ISO)
- `salaryMin` (filters `Job.salaryMax >= n`), `maxYoE` (filters `Job.minYoE <= n OR IS NULL`)
- `stackTags` (multi, ANY-match via GIN `&&`)
- `excludeCompanies` (multi)
- `savedSearchId` (loads from `SavedSearch.filters`, merges with explicit params)

Response adds `facets: { level, workMode, source, stackTags, companies }` — counts per value across the post-filter set, used by filter-bar badges.

**New route:** `GET /api/jobs/[id]` — full Job + UserJob for the side panel.

## Saved Searches API

- `GET /api/saved-searches` — list for current user, ordered by `sortIndex`
- `POST /api/saved-searches` — `{ name, filters }`
- `PATCH /api/saved-searches/[id]` — `{ name?, filters?, sortIndex? }`
- `DELETE /api/saved-searches/[id]`

## Dashboard UI

`web/app/dashboard/`:

- **Filter bar** (new sticky component under the header): chips/popovers for level, work-mode, source, location, posted-within (24h / 3d / 7d / 30d / custom), salary-min slider, YoE-max slider, stack-tags multi-select. Each chip shows facet count from the API. "Clear all" link on the right.
- **Saved-searches strip** above the filter bar: tabs (`All` / preset names). Clicking a preset loads its filters. "+ Save current" captures the active filter state. Right-click on a preset → rename / delete / pin.
- **Job rows** (`web/app/dashboard/_components/job-row.tsx`): clicking the row body opens the side panel; the explicit "Open original" icon-button keeps the external-link path. New chips on the row: level pill, work-mode pill, salary range (if present), freshness dot (green ≤6h / yellow ≤24h / gray older).
- **Job-detail side panel** (new component, ~520px, slide-in from right, `Esc`/click-outside to close):
  - Header: title · company · location · score with reason
  - AI summary block: level, work-mode, salary range, min YoE, stack chips
  - Full description (scrollable, monospace-friendly rendering of plaintext)
  - Collapsible PDF snapshot iframe (lazy-loaded)
  - Action row: Queue / Applied / Skip / "Hide jobs from {company}"
  - Notes textarea (persisted to `UserJob.emailNote` — repurposed)
  - Footer: "Open original posting" external link

All new UI components built per the tasteskill design pass directive in `CLAUDE.md`.

## GitHub Actions

`.github/workflows/scraper.yml` runs both lanes in the same job (Playwright browser cached for the snapshot step). New secrets in repo settings:
- `BRAVE_SEARCH_API_KEY`
- `SYSTEM_AI_API_KEY`
- `SEARCH_QUERIES_JSON`

Cadence stays every 2h.

## Out of Scope (Deferred)

- Keyboard-driven triage (j/k/q/a/s/x/enter)
- Visa / sponsorship signal extraction
- Manual URL paste/import flow
- Email or push notifications on high-score new jobs
- Per-user Brave queries (rejected during brainstorming due to quota math)

These are designed around — none of them require schema or API changes that conflict with this spec, so they can land cleanly in later phases.

## Verification

End-to-end test plan once implemented:

1. **Schema migration applies cleanly** — `prisma migrate dev` adds the new columns/indexes/tables without errors. Existing jobs continue to render in the feed with empty new fields.
2. **Brave lane discovers jobs** — set `BRAVE_SEARCH_API_KEY` locally; run `pnpm --filter scraper start`. Confirm logs show Brave-discovered URLs being enriched via per-ATS APIs and ingested.
3. **AI tagger populates fields** — confirm `Job.level`, `workMode`, `salaryMin/Max`, `stackTags`, `taggedAt` are set on at least 90% of newly ingested jobs. Inspect 10 random tagged jobs and verify level + workMode look correct.
4. **Backfill script works** — run `pnpm --filter web tsx scripts/backfill-tags.ts` against existing jobs; confirm `taggedAt` populates without rate-limit errors.
5. **Feed filters work** — exercise each new query param against `/api/jobs` and confirm the result set narrows as expected. Confirm `facets` counts match a hand-counted sample.
6. **Saved searches round-trip** — create a saved search, refresh the page, confirm it persists and applying it loads the filters.
7. **Hidden companies enforce** — add a company to the hide list, confirm: (a) existing matching `new` UserJobs flip to `skipped` with `autoSkippedReason='hidden_company'`; (b) next ingest cycle's jobs from that company also auto-skip; (c) removing the company restores only auto-skipped ones.
8. **Side panel UX** — click a feed row, confirm panel opens with full description, AI summary block, and PDF snapshot. Confirm `Esc` closes. Confirm action buttons update the row in-place without re-fetching the whole feed.
9. **Freshness dots render** — confirm green/yellow/gray dot states on rows of varying ages.
10. **GitHub Actions pipeline succeeds** — push the workflow change, watch the run; confirm both lanes run, dedup works (jobs visible from both lanes appear once), and ingest summary shows tagger success counts.

## Critical Files

**To create:**
- `scraper/src/scrapers/brave.ts`
- `scraper/src/utils/brave.ts`
- `web/lib/ai/tagger.ts`
- `web/lib/ai/tagger-prompt.ts`
- `web/scripts/backfill-tags.ts`
- `web/app/api/jobs/[id]/route.ts`
- `web/app/api/saved-searches/route.ts`
- `web/app/api/saved-searches/[id]/route.ts`
- `web/app/api/users/me/hidden-companies/route.ts`
- `web/app/api/users/me/hidden-companies/[company]/route.ts`
- `web/app/dashboard/_components/filter-bar.tsx`
- `web/app/dashboard/_components/saved-searches-strip.tsx`
- `web/app/dashboard/_components/job-detail-panel.tsx`

**To modify:**
- `web/prisma/schema.prisma` — new columns, enums, models, indexes
- `scraper/src/scrapers/ashby.ts`, `greenhouse.ts`, `lever.ts` — add `fetchOne(url)` helpers
- `scraper/src/index.ts` — orchestrate both lanes
- `scraper/src/types.ts` — JobRecord unchanged, but add Brave config type
- `scraper/src/utils/filter.ts` — keep, both lanes share it
- `web/app/api/jobs/ingest/route.ts` — add tagger pass + hidden-company auto-skip
- `web/app/api/jobs/route.ts` — new query params + facets
- `web/app/dashboard/page.tsx` — wire in filter bar + saved searches
- `web/app/dashboard/_components/job-feed.tsx` — wire side panel open, freshness dots, new chips
- `web/app/dashboard/_components/job-row.tsx` — chips, panel-open click handler
- `.github/workflows/scraper.yml` — new env/secrets

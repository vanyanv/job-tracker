# Step 4 Design: POST /api/jobs/ingest

**Date:** 2026-04-26
**Status:** Ready for review

---

## Decisions to Confirm

**1. Scoring strategy: inline vs. queued**

Recommended: **inline (blocking)**. For v1 with batches up to ~200 jobs and 1–5 users, the request completes in seconds using the `rules` provider and in ~30–120 s using a real LLM provider with 5-user concurrency. This avoids a queue infrastructure entirely. Flag: if a user batch of 200 jobs × 5 users × ~1 s/score = ~200 s with a slow provider, the GitHub Actions step that calls `/api/jobs/ingest` must set its HTTP timeout to at least 5 minutes. Document this in the workflow. Defer to a queue (BullMQ, Trigger.dev, etc.) only if Step 7 proves it too slow in practice.

**2. Rescoring on re-ingest: only score new UserJob rows**

Recommended: **skip rescoring existing rows**. When the same job URL is re-ingested, the Job row is upserted (title/company/description may be updated) but existing `UserJob` rows are left untouched. This prevents redundant AI calls on every 2-hour cron run and avoids clobbering a score the user manually adjusted. If a user wants a fresh score, a separate `POST /api/jobs/:id/rescore` endpoint can be added in Step 8.

**3. Idempotency on duplicate batches**

The Job upsert (by `url`) is safe to replay: calling the endpoint twice with the same payload produces the same DB state. UserJob creation uses `createMany({ skipDuplicates: true })` keyed on `(userId, jobId)`. So re-sending a batch is safe — second call returns `jobsNew: 0`, `userJobsCreated: 0`. The response counts will differ between calls, but DB state is stable.

**4. Initial UserJob status**

New `UserJob` rows are created with `status: "new"` — matching the status enum in CLAUDE.md and the Prisma schema default.

**5. Per-user scoring concurrency**

Recommended: **pool of 3 concurrent users** using `p-limit`. Sequential scoring (pool = 1) is simpler but unnecessarily slow for multi-user accounts. Unlimited parallelism risks hitting AI rate limits simultaneously. A pool of 3 is a safe default that respects free-tier rate limits (Groq: 14,400 req/day; Gemini: 1,500 req/day). Each user in the pool scores jobs sequentially within their own loop to avoid interleaving errors. `p-limit` is a small, ESM-native package with no transitive dependencies.

---

## Overview

Step 4 delivers a single authenticated HTTP endpoint that ingests batches of scraped job records, deduplicates them globally, creates per-user `UserJob` junction rows for every user who has a parsed resume, scores each new `UserJob` via the user's configured AI provider, and returns structured counts.

This endpoint is the central ingestion point for the scraper (Step 5). It is the only component in the system that writes `Job` and `UserJob` rows from external data.

No UI is built in this step. No scraper code is written. No R2 snapshots. No Gmail.

---

## Architecture

### Request/response flow

```
POST /api/jobs/ingest
  Authorization: Bearer ${INGEST_BEARER_TOKEN}
  Content-Type: application/json
  Body: { jobs: JobRecord[] }
  │
  ├─ 1. Bearer auth (constant-time compare)
  ├─ 2. Zod parse body → JobRecord[]
  ├─ 3. Upsert all jobs into Job table (url is unique key)
  │      track which cuid()s are new vs. already existed
  ├─ 4. Load all Users with skillsProfile != null
  │      (these are the only users who can be scored)
  ├─ 5. For each user (pool of 3):
  │      a. createMany UserJob rows for new jobs only, skipDuplicates
  │      b. For each new UserJob: call getProvider(user).scoreJob()
  │      c. Write score + scoreReason back to UserJob
  │      d. Catch per-job errors; accumulate into errors[]
  ├─ 6. Return counts + errors
  └─ 200 { ok: true, jobsReceived, jobsNew, jobsExisting, userJobsCreated, userJobsScored, errors }
```

### Key design choices

**Single-pass upsert for Job deduplication.** `prisma.job.upsert({ where: { url }, create: {...}, update: {...} })` is called for each record in a `Promise.all` loop. Neon Postgres serialises concurrent upserts on the `url` unique index. We track which jobs are truly new by doing a `prisma.job.findMany({ where: { url: { in: urls } }, select: { url: true } })` BEFORE the upserts and comparing.

**UserJob creation then scoring are separate passes.** First `createMany` all new `UserJob` rows for a user (single query), then iterate and score each one. This ensures we never score a job whose `UserJob` row failed to persist.

**Per-user error isolation.** Each user's scoring loop is wrapped in `try/catch`. A provider failure for one user does not abort scoring for others. Per-job failures within a user's loop are similarly caught. All failures are collected into `errors[]` in the response — the scraper can log these without treating the whole batch as failed.

**Bearer token comparison.** `crypto.timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))` — both buffers must be the same length before calling `timingSafeEqual`. If lengths differ, return 401 immediately (length difference is not itself a timing oracle for a fixed-length token).

---

## Zod Request Schema

Defined in `web/app/api/jobs/ingest/schema.ts`:

```typescript
export const JobRecordSchema = z.object({
  url:         z.string().url(),
  title:       z.string().min(1),
  company:     z.string().min(1),
  location:    z.string().min(1),
  description: z.string().nullable().optional(),
  source:      z.enum(["ashby", "greenhouse", "lever"]),
  postedAt:    z.string().datetime(),
  snapshotUrl: z.string().url().nullable().optional(),
});

export const IngestBodySchema = z.object({
  jobs: z.array(JobRecordSchema).min(1).max(200),
});

export type JobRecord = z.infer<typeof JobRecordSchema>;
export type IngestBody = z.infer<typeof IngestBodySchema>;
```

`postedAt` is a `z.string().datetime()` (ISO 8601 string). The route handler converts it to a `Date` before writing to Prisma. `description` and `snapshotUrl` are optional nullables matching the schema's `String?` fields.

---

## File Map

**Created in this step:**

| File | Responsibility |
|---|---|
| `web/app/api/jobs/ingest/route.ts` | Route handler: auth, parse, upsert, score, respond |
| `web/app/api/jobs/ingest/schema.ts` | Zod schemas for JobRecord and IngestBody |
| `web/app/api/jobs/ingest/route.test.ts` | Vitest tests: mock prisma + provider, all code paths |

**Modified in this step:**

| File | Change |
|---|---|
| `web/package.json` | Add `p-limit` to dependencies |
| `web/.env` | Add `INGEST_BEARER_TOKEN` placeholder |

---

## Error Handling

| Condition | Response |
|---|---|
| Missing or malformed `Authorization` header | 401 `{ error: "Unauthorized" }` |
| Token does not match `INGEST_BEARER_TOKEN` | 401 `{ error: "Unauthorized" }` |
| `INGEST_BEARER_TOKEN` not set in env | 500 `{ error: "Server misconfiguration" }` (logged server-side) |
| Body is not valid JSON | 400 `{ error: "Invalid JSON body" }` |
| Body fails `IngestBodySchema.parse` | 400 `{ error: "Invalid request body", issues: ZodError.issues }` |
| Prisma upsert throws for a job record | Caught per-job; added to `errors[]`; batch continues |
| `getProvider(user).scoreJob()` throws | Caught per-UserJob; added to `errors[]`; scoring continues |
| `prisma.userJob.update()` throws after score | Caught per-UserJob; added to `errors[]` |
| Any unhandled exception | 500 `{ error: "Internal server error" }` (logged) |

Per-job and per-user errors never abort the batch. The scraper treats any `errors[]` as warnings to log, not as a failed request (HTTP 200 with errors in body).

---

## Environment Variables

New variable added by Step 4:

| Variable | Location | Value |
|---|---|---|
| `INGEST_BEARER_TOKEN` | Vercel env + local `web/.env` + GitHub Actions secrets | Random UUID or 32+ char hex string |

Generation:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `INGEST_BEARER_TOKEN` value must be identical in both Vercel (production) and GitHub Actions secrets. The route validates against `process.env.INGEST_BEARER_TOKEN`. If the env var is absent, the route returns 500 to prevent accidentally open ingestion endpoints on new deployments.

---

## Testing Strategy

**Runner:** `vitest` (already set up in Step 3). **Config:** existing `web/vitest.config.ts`.

**Mocking approach:** `vi.mock("@/lib/prisma", ...)` returns a plain object with jest-style mock functions. `vi.mock("@/lib/ai/provider", ...)` stubs `getProvider` to return a mock `AIProvider`. The route handler is imported directly and called with a synthetic `NextRequest`. No HTTP server is needed.

Test file: `web/app/api/jobs/ingest/route.test.ts`

| Test | What it covers |
|---|---|
| Missing Authorization header | → 401 |
| Wrong bearer token | → 401 |
| Correct token | → passes auth |
| Body missing `jobs` field | → 400 with Zod issues |
| `jobs` array exceeds 200 | → 400 |
| `url` fails URL format | → 400 |
| Valid batch, all new jobs, 1 user with profile | → 200, correct counts |
| Valid batch, all existing jobs | → jobsNew: 0, userJobsCreated: 0 |
| Mixed new/existing jobs | → correct new count |
| No users with skillsProfile | → userJobsCreated: 0, userJobsScored: 0 |
| User without skillsProfile skipped | → only eligible users scored |
| Provider throws on one job | → error in errors[], batch continues, HTTP 200 |
| INGEST_BEARER_TOKEN not set | → 500 |

---

## What This Step Does NOT Include

- No scraper code (Step 5)
- No Cloudflare R2 PDF snapshots (Step 6) — `snapshotUrl` is accepted in the request body and stored on the Job row, but the upload itself is out of scope
- No Gmail integration (Step 9)
- No dashboard UI (Step 10)
- No rescore endpoint for existing UserJobs — deferred to Step 8
- No database migration — all fields already exist in the schema from Step 1
- No `EMAIL_SYNC_BEARER_TOKEN` endpoint — that is Step 9

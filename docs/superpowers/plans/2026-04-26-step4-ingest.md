# Step 4: POST /api/jobs/ingest — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `POST /api/jobs/ingest` — a bearer-token-authenticated endpoint that upserts scraped job records globally, creates `UserJob` junction rows for eligible users, scores each new `UserJob` via the user's configured AI provider, and returns structured counts. No UI, no scraper, no R2.

**Architecture summary:** Zod schema validates the request body. Bearer auth uses `crypto.timingSafeEqual` for constant-time comparison. Job deduplication uses a pre-upsert URL lookup to accurately track new vs. existing records. Per-user scoring runs in a `p-limit` pool of 3, with per-job error isolation. All providers use the existing `getProvider(user)` factory from Step 3.

**Tech stack additions (beyond Step 3):**

| Package | Type | Purpose |
|---|---|---|
| `p-limit` | dep | Bounded concurrency pool for per-user scoring |

---

## File Map

**Created in this step:**

| File | Responsibility |
|---|---|
| `web/app/api/jobs/ingest/schema.ts` | Zod schemas: `JobRecordSchema`, `IngestBodySchema` |
| `web/app/api/jobs/ingest/route.ts` | Route handler: auth, upsert, score, respond |
| `web/app/api/jobs/ingest/route.test.ts` | Vitest tests: all code paths with mocked prisma + provider |

**Modified in this step:**

| File | Change |
|---|---|
| `web/package.json` | Add `p-limit` to `"dependencies"` |
| `web/.env` | Add `INGEST_BEARER_TOKEN` placeholder |

---

## Chunk 1: Env Var + Dependency

### Task 1: Generate INGEST_BEARER_TOKEN and install p-limit

- [ ] **Step 1:** Generate token with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and append to `web/.env` as `INGEST_BEARER_TOKEN="..."`.
- [ ] **Step 2:** Add `"p-limit": "^6.2.0"` to `web/package.json` dependencies (v6 not v7 — v7 is pure ESM and conflicts with Next.js CJS/ESM hybrid).
- [ ] **Step 3:** Run `pnpm install` from repo root, expect exit 0.
- [ ] **Step 4:** Commit: `feat(step4): add p-limit dep and INGEST_BEARER_TOKEN env placeholder`.

---

## Chunk 2: Zod Request Schema

### Task 2: Create `web/app/api/jobs/ingest/schema.ts`

- [ ] **Step 1:** `mkdir -p web/app/api/jobs/ingest`.
- [ ] **Step 2:** Write `schema.ts` with `JobRecordSchema` and `IngestBodySchema` (see design doc).
- [ ] **Step 3:** Run `cd web && pnpm exec tsc --noEmit --skipLibCheck`, expect exit 0.
- [ ] **Step 4:** Commit: `feat(step4): Zod request schema for ingest endpoint`.

---

## Chunk 3: Route Handler — Auth + Body Parse Skeleton

### Task 3: Create `route.ts` with auth + body parse only

- [ ] **Step 1:** Write `route.ts` with imports, `checkBearer()` helper using `crypto.timingSafeEqual`, and a `POST` handler that returns a placeholder response after validation.
- [ ] **Step 2:** Run `pnpm exec tsc --noEmit --skipLibCheck`, expect exit 0.
- [ ] **Step 3:** Commit: `feat(step4): ingest route skeleton — auth + body parse`.

```typescript
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/ai/provider";
import type { ResumeProfile } from "@/lib/ai/provider";
import pLimit from "p-limit";
import { IngestBodySchema, type JobRecord } from "./schema";

function checkBearer(req: NextRequest): boolean {
  const token = process.env.INGEST_BEARER_TOKEN;
  if (!token) return false;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const incoming = authHeader.slice(7);
  if (incoming.length !== token.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(incoming, "utf8"),
    Buffer.from(token, "utf8"),
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.INGEST_BEARER_TOKEN) {
    console.error("[api/jobs/ingest] INGEST_BEARER_TOKEN is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (!checkBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = IngestBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { jobs: records } = parsed.data;
  return NextResponse.json({
    ok: true,
    jobsReceived: records.length,
    jobsNew: 0,
    jobsExisting: 0,
    userJobsCreated: 0,
    userJobsScored: 0,
    errors: [] as Array<{ context: string; error: string }>,
  });
}
```

---

## Chunk 4: Job Upsert + Dedupe Logic

### Task 4: Implement `upsertJobs` helper

- [ ] **Step 1:** Add `upsertJobs(records)` helper above `POST` that does pre-upsert URL lookup → bulk `Promise.all` upserts → returns `{ allJobIds: Map<url,id>, newJobIds: Set<id> }`.
- [ ] **Step 2:** Wire `upsertJobs` into `POST` handler, return real `jobsNew` / `jobsExisting`.
- [ ] **Step 3:** TypeScript check exit 0.
- [ ] **Step 4:** Commit: `feat(step4): Job upsert + URL-based deduplication`.

```typescript
interface UpsertResult {
  allJobIds: Map<string, string>;
  newJobIds: Set<string>;
}

async function upsertJobs(records: JobRecord[]): Promise<UpsertResult> {
  const incomingUrls = records.map((r) => r.url);
  const existing = await prisma.job.findMany({
    where: { url: { in: incomingUrls } },
    select: { url: true },
  });
  const existingUrlSet = new Set(existing.map((j) => j.url));

  const upserted = await Promise.all(
    records.map((r) =>
      prisma.job
        .upsert({
          where: { url: r.url },
          create: {
            url: r.url,
            title: r.title,
            company: r.company,
            location: r.location,
            description: r.description ?? null,
            source: r.source,
            postedAt: new Date(r.postedAt),
            snapshotUrl: r.snapshotUrl ?? null,
          },
          update: {
            title: r.title,
            company: r.company,
            location: r.location,
            description: r.description ?? null,
            snapshotUrl: r.snapshotUrl ?? null,
          },
          select: { id: true, url: true },
        })
        .catch((err) => {
          console.error(`[api/jobs/ingest] upsert failed for ${r.url}:`, err);
          return null;
        }),
    ),
  );

  const allJobIds = new Map<string, string>();
  const newJobIds = new Set<string>();
  for (const job of upserted) {
    if (!job) continue;
    allJobIds.set(job.url, job.id);
    if (!existingUrlSet.has(job.url)) newJobIds.add(job.id);
  }
  return { allJobIds, newJobIds };
}
```

---

## Chunk 5: Per-User UserJob Creation + Scoring

### Task 5: Implement per-user scoring with p-limit

- [ ] **Step 1:** Add `scoreForUser(user, newJobIds, jobInputMap, errors)` helper that creates UserJob rows via `createMany({ skipDuplicates: true })`, fetches them back, scores each via `getProvider(user).scoreJob()`, writes score + scoreReason. Catches per-row errors into `errors[]`.
- [ ] **Step 2:** In `POST`, load eligible users (`skillsProfile: { not: null }`), build `jobInputMap` (jobId → JobInput), run `Promise.all` over users with `pLimit(3)`, sum counts, return final response.
- [ ] **Step 3:** TypeScript check exit 0. Note: filter users to narrow `skillsProfile: string | null` to `string`.
- [ ] **Step 4:** Commit: `feat(step4): per-user UserJob creation + AI scoring with p-limit concurrency`.

```typescript
type IngestError = { context: string; error: string };
type EligibleUser = { id: string; aiProvider: string | null; aiApiKey: string | null; skillsProfile: string };

async function scoreForUser(
  user: EligibleUser,
  newJobIds: Set<string>,
  jobInputMap: Map<string, { title: string; company: string; location: string; description: string | null }>,
  errors: IngestError[],
): Promise<{ userJobsCreated: number; userJobsScored: number }> {
  if (newJobIds.size === 0) return { userJobsCreated: 0, userJobsScored: 0 };

  const profile: ResumeProfile = {
    skills: user.skillsProfile.split(",").map((s) => s.trim()).filter(Boolean),
    titles: [],
    yearsExperience: 0,
    summary: "",
  };

  const createData = Array.from(newJobIds).map((jobId) => ({
    userId: user.id,
    jobId,
    status: "new" as const,
  }));

  let createdCount = 0;
  try {
    const result = await prisma.userJob.createMany({ data: createData, skipDuplicates: true });
    createdCount = result.count;
  } catch (err) {
    errors.push({ context: `user:${user.id} createMany`, error: String(err) });
    return { userJobsCreated: 0, userJobsScored: 0 };
  }

  const userJobs = await prisma.userJob.findMany({
    where: { userId: user.id, jobId: { in: Array.from(newJobIds) } },
    select: { id: true, jobId: true },
  });

  const provider = getProvider(user);
  let scoredCount = 0;
  for (const uj of userJobs) {
    const jobInput = jobInputMap.get(uj.jobId);
    if (!jobInput) continue;
    try {
      const result = await provider.scoreJob(jobInput, profile);
      await prisma.userJob.update({
        where: { id: uj.id },
        data: { score: result.score, scoreReason: result.reason },
      });
      scoredCount++;
    } catch (err) {
      errors.push({ context: `user:${user.id} job:${uj.jobId}`, error: String(err) });
    }
  }
  return { userJobsCreated: createdCount, userJobsScored: scoredCount };
}
```

`POST` body after the upsert:

```typescript
  const eligibleRaw = await prisma.user.findMany({
    where: { skillsProfile: { not: null } },
    select: { id: true, aiProvider: true, aiApiKey: true, skillsProfile: true },
  });
  const eligibleUsers: EligibleUser[] = eligibleRaw.filter(
    (u): u is EligibleUser => u.skillsProfile !== null,
  );

  const jobInputMap = new Map<string, { title: string; company: string; location: string; description: string | null }>();
  for (const r of records) {
    const id = allJobIds.get(r.url);
    if (id) jobInputMap.set(id, { title: r.title, company: r.company, location: r.location, description: r.description ?? null });
  }

  const errors: IngestError[] = [];
  const limit = pLimit(3);
  const scoringResults = await Promise.all(
    eligibleUsers.map((user) => limit(() => scoreForUser(user, newJobIds, jobInputMap, errors))),
  );

  const totalUserJobsCreated = scoringResults.reduce((sum, r) => sum + r.userJobsCreated, 0);
  const totalUserJobsScored = scoringResults.reduce((sum, r) => sum + r.userJobsScored, 0);

  return NextResponse.json({
    ok: true,
    jobsReceived: records.length,
    jobsNew: newJobIds.size,
    jobsExisting: allJobIds.size - newJobIds.size,
    userJobsCreated: totalUserJobsCreated,
    userJobsScored: totalUserJobsScored,
    errors,
  });
```

---

## Chunk 6: Vitest Tests

### Task 6: Create `route.test.ts`

- [ ] **Step 1:** Write the test file with `vi.mock("@/lib/prisma")` and `vi.mock("@/lib/ai/provider")`, import `POST` and call it with synthetic `NextRequest`. Cover: auth (3), validation (5), dedup (2), scoring (4), response shape (1). 15 tests total.
- [ ] **Step 2:** Run `pnpm exec vitest run app/api/jobs/ingest/route.test.ts`, expect all pass.
- [ ] **Step 3:** Commit: `feat(step4): vitest tests for ingest route — auth, validation, dedup, scoring`.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    job: { findMany: vi.fn(), upsert: vi.fn() },
    userJob: { createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

const mockScoreJob = vi.fn();
vi.mock("@/lib/ai/provider", () => ({
  getProvider: vi.fn(() => ({ scoreJob: mockScoreJob })),
}));

import { POST } from "./route";
import { prisma } from "@/lib/prisma";

const VALID_TOKEN = "test-token-abc123";
const VALID_JOB = {
  url: "https://jobs.ashby.io/acme/swe-1",
  title: "Senior Software Engineer",
  company: "Acme",
  location: "Remote, US",
  description: "TypeScript, React, Node.js",
  source: "ashby" as const,
  postedAt: "2026-04-26T08:00:00.000Z",
  snapshotUrl: null,
};

function makeRequest(body: unknown, token?: string): NextRequest {
  return new NextRequest("http://localhost/api/jobs/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INGEST_BEARER_TOKEN = VALID_TOKEN;
  (prisma.job.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.job.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1", url: VALID_JOB.url });
  (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.userJob.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
  (prisma.userJob.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  mockScoreJob.mockResolvedValue({ score: 80, reason: "Great match" });
});

// auth, validation, dedup, scoring, response shape — see design doc test table
```

(Full test bodies follow the table in the design doc — auth: missing header → 401, wrong token → 401, missing env → 500, correct token → not 401. validation: invalid JSON → 400, missing jobs → 400, >200 → 400, bad URL → 400, bad source → 400. dedup: all new → jobsNew=N, all existing → jobsExisting=N. scoring: eligible user → counts correct, no eligible users → 0, provider throws → errors[] populated + HTTP 200, all-existing batch → mockScoreJob not called. shape: response matches expected fields.)

---

## Chunk 7: Final Verification

### Task 7: Typecheck + tests + build + commit

- [ ] **Step 1:** `cd web && pnpm exec tsc --noEmit` exits 0.
- [ ] **Step 2:** `ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") pnpm exec vitest run` — all CI-safe tests pass (crypto, rules, ingest), API-gated suites skip cleanly.
- [ ] **Step 3:** `pnpm --filter web build` — clean build, `/api/jobs/ingest` appears as dynamic route.
- [ ] **Step 4:** Update `CLAUDE.md` to mark Step 4 with `[x]`.
- [ ] **Step 5:** Final commit: `feat: complete Step 4 — POST /api/jobs/ingest with dedup, scoring, bearer auth`.

---

## Verification Summary

| Check | Command | Expected |
|---|---|---|
| p-limit installs | `pnpm install` (from root) | Exits 0 |
| TypeScript | `cd web && pnpm exec tsc --noEmit` | Exits 0, 0 errors |
| Ingest route tests | `pnpm exec vitest run app/api/jobs/ingest/route.test.ts` | All pass |
| All CI-safe tests | `ENCRYPTION_KEY=<64hex> pnpm exec vitest run` | All pass, gated suites skip |
| Build | `pnpm --filter web build` | No errors |

---

## What This Step Does NOT Include

- No scraper code (Step 5)
- No Cloudflare R2 PDF upload (Step 6) — `snapshotUrl` is stored if provided, upload itself is out of scope
- No Gmail integration (Step 9)
- No dashboard UI (Step 10)
- No `POST /api/jobs/:id/rescore` endpoint — deferred to Step 8
- No database migration — all fields exist from Step 1

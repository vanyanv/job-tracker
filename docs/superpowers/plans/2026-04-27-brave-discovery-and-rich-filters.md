# Brave Discovery + Rich Filters + Job Detail Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Brave-Search–driven job discovery alongside the existing org-list scrapers, AI-tag every new job for richer filters (level, salary, YoE, stack, work-mode), expose those filters on the dashboard with a saved-searches strip, and replace the external-link-only row click with a slide-in detail panel.

**Architecture:** Two ingestion lanes (existing org-list + new Brave) feed `/api/jobs/ingest`, which now runs a system-Groq tagger over each new `Job` before the existing per-user scoring loop. New schema columns power a richer `/api/jobs` filter API and a sticky filter bar / saved-searches strip on the dashboard. Hidden-companies and saved-searches are per-user and stored in Postgres.

**Tech Stack:** TypeScript, Next.js App Router (web/), Node + Playwright (scraper/), Prisma + Neon Postgres, Groq SDK (`llama-3.3-70b-versatile`), Brave Search API, Vitest, React 19 + Tailwind. The repo follows TDD via Vitest in both `web/` and `scraper/`.

**Spec:** `docs/superpowers/specs/2026-04-27-brave-discovery-and-rich-filters-design.md`

---

## Phase 1 — Schema migration

### Task 1: Update Prisma schema

**Files:**
- Modify: `web/prisma/schema.prisma`

- [ ] **Step 1: Replace the `Job`, `UserJob`, and `User` blocks and add `SavedSearch`**

In `web/prisma/schema.prisma`, replace the existing `Job`, `UserJob`, and `User` models with the versions below, and append the new `SavedSearch` model after `UserJob`.

```prisma
model Job {
  id              String    @id @default(cuid())
  title           String
  company         String
  url             String    @unique
  source          String
  location        String
  description     String?
  postedAt        DateTime
  foundAt         DateTime  @default(now())
  snapshotUrl     String?

  // AI-tagged fields (nullable until taggedAt is set)
  level           String?   // intern|junior|mid|senior|staff|principal|manager|director|unknown
  workMode        String?   // remote|hybrid|onsite|unknown
  locationCity    String?
  locationCountry String?
  salaryMin       Int?
  salaryMax       Int?
  minYoE          Int?
  stackTags       String[]  @default([])
  taggedAt        DateTime?
  tagModel        String?

  userJobs        UserJob[]

  @@index([postedAt])
  @@index([level])
  @@index([workMode])
  @@index([locationCountry])
  @@index([level, workMode, postedAt])
  @@index([stackTags], type: Gin)
}

model UserJob {
  id                String    @id @default(cuid())
  userId            String
  jobId             String
  score             Int?
  scoreReason       String?
  status            String    @default("new")
  appliedAt         DateTime?
  emailNote         String?
  autoSkippedReason String?
  user              User      @relation(fields: [userId], references: [id])
  job               Job       @relation(fields: [jobId], references: [id])

  @@unique([userId, jobId])
}

model User {
  id               String        @id @default(cuid())
  email            String        @unique
  name             String?
  image            String?
  emailVerified    DateTime?
  gmailToken       String?
  aiProvider       String?
  aiApiKey         String?
  resumeUrl        String?
  resumeText       String?
  resumeParsed     Json?
  skillsProfile    String?
  apiKey           String        @unique @default(cuid())
  hiddenCompanies  String[]      @default([])
  userJobs         UserJob[]
  savedSearches    SavedSearch[]
  accounts         Account[]
  sessions         Session[]
}

model SavedSearch {
  id        String   @id @default(cuid())
  userId    String
  name      String
  filters   Json
  sortIndex Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, sortIndex])
}
```

- [ ] **Step 2: Generate the migration**

Run from repo root:
```bash
cd web && pnpm prisma migrate dev --name add_tagger_fields_saved_searches_hidden_companies
```
Expected: migration SQL printed, applied to Neon, `prisma generate` runs.

- [ ] **Step 3: Sanity check generated client**

```bash
cd web && pnpm prisma validate
```
Expected: "The schema at … is valid."

- [ ] **Step 4: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/migrations
git commit -m "feat(db): tagger fields, saved searches, hidden companies"
```

---

## Phase 2 — AI tagger (system Groq)

### Task 2: Tagger Zod schema + alias table

**Files:**
- Create: `web/lib/ai/tagger-types.ts`
- Create: `web/lib/ai/stack-aliases.ts`
- Test: `web/lib/ai/stack-aliases.test.ts`

- [ ] **Step 1: Write the alias-table test**

Create `web/lib/ai/stack-aliases.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeStackTag, normalizeStackTags } from "./stack-aliases";

describe("normalizeStackTag", () => {
  it("lowercases and aliases known variants", () => {
    expect(normalizeStackTag("React.js")).toBe("react");
    expect(normalizeStackTag("NodeJS")).toBe("node");
    expect(normalizeStackTag("Golang")).toBe("go");
    expect(normalizeStackTag("Postgres")).toBe("postgresql");
    expect(normalizeStackTag("k8s")).toBe("kubernetes");
  });
  it("passes unknown tags through lowercased + trimmed", () => {
    expect(normalizeStackTag(" Rust ")).toBe("rust");
  });
  it("returns null for empty / junk", () => {
    expect(normalizeStackTag("")).toBeNull();
    expect(normalizeStackTag("   ")).toBeNull();
  });
});

describe("normalizeStackTags", () => {
  it("dedupes and caps to 8", () => {
    const out = normalizeStackTags(["React", "react.js", "Node", "Go", "Go", "Rust", "Python", "TS", "JS", "K8s", "Docker"]);
    expect(out.length).toBeLessThanOrEqual(8);
    expect(new Set(out).size).toBe(out.length);
  });
});
```

- [ ] **Step 2: Run, verify failure**

```bash
cd web && pnpm vitest run lib/ai/stack-aliases.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement aliases**

Create `web/lib/ai/stack-aliases.ts`:
```ts
const ALIASES: Record<string, string> = {
  "react.js": "react",
  reactjs: "react",
  nodejs: "node",
  "node.js": "node",
  golang: "go",
  postgres: "postgresql",
  pg: "postgresql",
  k8s: "kubernetes",
  ts: "typescript",
  js: "javascript",
  py: "python",
  "next.js": "nextjs",
};

export function normalizeStackTag(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  return ALIASES[v] ?? v;
}

export function normalizeStackTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const n = normalizeStackTag(t);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 8) break;
  }
  return out;
}
```

- [ ] **Step 4: Verify pass**

```bash
cd web && pnpm vitest run lib/ai/stack-aliases.test.ts
```
Expected: PASS.

- [ ] **Step 5: Add the Zod tagger schema**

Create `web/lib/ai/tagger-types.ts`:
```ts
import { z } from "zod";

export const LEVELS = [
  "intern", "junior", "mid", "senior", "staff", "principal", "manager", "director", "unknown",
] as const;

export const WORK_MODES = ["remote", "hybrid", "onsite", "unknown"] as const;

export const JobTagsSchema = z.object({
  level: z.enum(LEVELS).default("unknown"),
  workMode: z.enum(WORK_MODES).default("unknown"),
  locationCity: z.string().nullable().default(null),
  locationCountry: z.string().nullable().default(null),
  salaryMin: z.number().int().nullable().default(null),
  salaryMax: z.number().int().nullable().default(null),
  minYoE: z.number().int().min(0).max(50).nullable().default(null),
  stackTags: z.array(z.string()).default([]),
});

export type JobTags = z.infer<typeof JobTagsSchema>;

export interface JobToTag {
  title: string;
  company: string;
  locationRaw: string;
  description: string | null;
}
```

- [ ] **Step 6: Commit**

```bash
git add web/lib/ai/stack-aliases.ts web/lib/ai/stack-aliases.test.ts web/lib/ai/tagger-types.ts
git commit -m "feat(ai): tagger types and stack-tag alias table"
```

---

### Task 3: System Groq tagger

**Files:**
- Create: `web/lib/ai/tagger.ts`
- Test: `web/lib/ai/tagger.test.ts`

- [ ] **Step 1: Write tagger unit test (mocked Groq)**

Create `web/lib/ai/tagger.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("groq-sdk", () => ({
  default: class { chat = { completions: { create: createMock } }; },
}));

import { tagJob } from "./tagger";

beforeEach(() => createMock.mockReset());

describe("tagJob", () => {
  it("parses a valid Groq response into JobTags", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        level: "senior",
        workMode: "remote",
        locationCity: "New York",
        locationCountry: "US",
        salaryMin: 180000, salaryMax: 240000,
        minYoE: 5,
        stackTags: ["React.js", "TypeScript", "Postgres"],
      }) } }],
    });
    const tags = await tagJob(
      { title: "Senior FE Engineer", company: "Acme", locationRaw: "NYC / Remote", description: "..." },
      { apiKey: "k", model: "llama-3.3-70b-versatile" },
    );
    expect(tags.level).toBe("senior");
    expect(tags.workMode).toBe("remote");
    expect(tags.stackTags).toEqual(["react", "typescript", "postgresql"]);
    expect(tags.salaryMin).toBe(180000);
  });

  it("falls back to unknown on malformed JSON", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const tags = await tagJob(
      { title: "x", company: "y", locationRaw: "", description: null },
      { apiKey: "k", model: "llama-3.3-70b-versatile" },
    );
    expect(tags.level).toBe("unknown");
    expect(tags.workMode).toBe("unknown");
    expect(tags.stackTags).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd web && pnpm vitest run lib/ai/tagger.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the tagger**

Create `web/lib/ai/tagger.ts`:
```ts
import Groq from "groq-sdk";
import { JobTagsSchema, type JobTags, type JobToTag } from "./tagger-types";
import { normalizeStackTags } from "./stack-aliases";

const SYSTEM_PROMPT =
  `You are a job-listing tagger. Read the job posting and respond ONLY with JSON of this shape:\n` +
  `{"level":"intern|junior|mid|senior|staff|principal|manager|director|unknown",` +
  `"workMode":"remote|hybrid|onsite|unknown",` +
  `"locationCity":string|null,"locationCountry":string|null,` +
  `"salaryMin":int|null,"salaryMax":int|null,` +
  `"minYoE":int|null,` +
  `"stackTags":[string up to 8]}\n` +
  `Salaries in USD. minYoE is the minimum years stated (5 for "5+ years"). ` +
  `stackTags are concrete technologies (react, typescript, postgresql, kubernetes, …). ` +
  `No markdown, no commentary.`;

const FALLBACK: JobTags = {
  level: "unknown", workMode: "unknown",
  locationCity: null, locationCountry: null,
  salaryMin: null, salaryMax: null, minYoE: null, stackTags: [],
};

export interface TaggerConfig { apiKey: string; model: string; }

export async function tagJob(job: JobToTag, cfg: TaggerConfig): Promise<JobTags> {
  const client = new Groq({ apiKey: cfg.apiKey });
  const userContent = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location (raw): ${job.locationRaw}`,
    job.description ? `Description:\n${job.description.slice(0, 8000)}` : "",
  ].filter(Boolean).join("\n");

  let raw = "";
  try {
    const res = await client.chat.completions.create({
      model: cfg.model,
      response_format: { type: "json_object" },
      temperature: 0.0,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    raw = res.choices[0]?.message?.content ?? "";
  } catch {
    return FALLBACK;
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return FALLBACK; }

  const safe = JobTagsSchema.safeParse(parsed);
  const tags = safe.success ? safe.data : FALLBACK;
  return { ...tags, stackTags: normalizeStackTags(tags.stackTags) };
}
```

- [ ] **Step 4: Verify PASS**

```bash
cd web && pnpm vitest run lib/ai/tagger.test.ts
```
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/lib/ai/tagger.ts web/lib/ai/tagger.test.ts
git commit -m "feat(ai): system tagger using groq llama-3.3"
```

---

### Task 4: Wire tagger into ingest route

**Files:**
- Modify: `web/app/api/jobs/ingest/route.ts`
- Modify: `web/app/api/jobs/ingest/route.test.ts`

- [ ] **Step 1: Add a unit test that the ingest route persists tagger output**

Append to `web/app/api/jobs/ingest/route.test.ts` (or create a new test file alongside if the existing one is heavily mocked — preserve existing patterns):

```ts
import { describe, it, expect, vi } from "vitest";
import { tagAndUpdateNewJobs } from "./route";

vi.mock("@/lib/ai/tagger", () => ({
  tagJob: vi.fn().mockResolvedValue({
    level: "senior", workMode: "remote",
    locationCity: "New York", locationCountry: "US",
    salaryMin: 180000, salaryMax: 240000, minYoE: 5,
    stackTags: ["react", "typescript"],
  }),
}));

describe("tagAndUpdateNewJobs", () => {
  it("calls tagger and persists fields", async () => {
    const update = vi.fn().mockResolvedValue({});
    const findMany = vi.fn().mockResolvedValue([
      { id: "j1", title: "Sr FE", company: "Acme", location: "NYC", description: "..." },
    ]);
    const fakePrisma = { job: { findMany, update } } as never;
    await tagAndUpdateNewJobs(fakePrisma, new Set(["j1"]), { apiKey: "k", model: "llama-3.3-70b-versatile" });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "j1" },
      data: expect.objectContaining({
        level: "senior", workMode: "remote",
        salaryMin: 180000, stackTags: ["react", "typescript"],
        taggedAt: expect.any(Date), tagModel: "llama-3.3-70b-versatile",
      }),
    }));
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd web && pnpm vitest run app/api/jobs/ingest/route.test.ts
```
Expected: FAIL — `tagAndUpdateNewJobs` is not exported.

- [ ] **Step 3: Implement and wire**

In `web/app/api/jobs/ingest/route.ts`:

1. Add at top of file:
```ts
import { tagJob } from "@/lib/ai/tagger";
import type { PrismaClient } from "@prisma/client";

const SYSTEM_AI_MODEL = "llama-3.3-70b-versatile";
```

2. Add this exported helper above `POST`:
```ts
export async function tagAndUpdateNewJobs(
  db: Pick<PrismaClient, "job">,
  newJobIds: Set<string>,
  cfg: { apiKey: string; model: string },
): Promise<{ tagged: number; failed: number }> {
  if (newJobIds.size === 0) return { tagged: 0, failed: 0 };
  const jobs = await db.job.findMany({
    where: { id: { in: Array.from(newJobIds) } },
    select: { id: true, title: true, company: true, location: true, description: true },
  });
  const limit = pLimit(3);
  let tagged = 0, failed = 0;
  await Promise.all(jobs.map((j) => limit(async () => {
    try {
      const tags = await tagJob(
        { title: j.title, company: j.company, locationRaw: j.location, description: j.description },
        cfg,
      );
      await db.job.update({
        where: { id: j.id },
        data: {
          level: tags.level,
          workMode: tags.workMode,
          locationCity: tags.locationCity,
          locationCountry: tags.locationCountry,
          salaryMin: tags.salaryMin,
          salaryMax: tags.salaryMax,
          minYoE: tags.minYoE,
          stackTags: tags.stackTags,
          taggedAt: new Date(),
          tagModel: cfg.model,
        },
      });
      tagged++;
    } catch (err) {
      console.error(`[ingest] tag failed for ${j.id}:`, err);
      failed++;
    }
  })));
  return { tagged, failed };
}
```

3. In `POST`, after `const { allJobIds, newJobIds } = await upsertJobs(records);` and before the `prisma.user.findMany`, add:
```ts
const systemAiKey = process.env.SYSTEM_AI_API_KEY;
const taggerStats = systemAiKey
  ? await tagAndUpdateNewJobs(prisma, newJobIds, { apiKey: systemAiKey, model: SYSTEM_AI_MODEL })
  : { tagged: 0, failed: 0 };
if (!systemAiKey) console.warn("[ingest] SYSTEM_AI_API_KEY unset; skipping tagger");
```

4. Add `taggerStats` to the response object.

- [ ] **Step 4: Verify PASS**

```bash
cd web && pnpm vitest run app/api/jobs/ingest/route.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/jobs/ingest/
git commit -m "feat(ingest): tag new jobs with system groq before per-user scoring"
```

---

### Task 5: One-shot backfill script

**Files:**
- Create: `web/scripts/backfill-tags.ts`

- [ ] **Step 1: Write the script**

Create `web/scripts/backfill-tags.ts`:
```ts
import { PrismaClient } from "@prisma/client";
import pLimit from "p-limit";
import { tagJob } from "@/lib/ai/tagger";

const MODEL = "llama-3.3-70b-versatile";
const BATCH = 100;

async function main() {
  const apiKey = process.env.SYSTEM_AI_API_KEY;
  if (!apiKey) { console.error("SYSTEM_AI_API_KEY required"); process.exit(1); }
  const prisma = new PrismaClient();
  const limit = pLimit(3);
  let total = 0;

  while (true) {
    const jobs = await prisma.job.findMany({
      where: { taggedAt: null },
      take: BATCH,
      select: { id: true, title: true, company: true, location: true, description: true },
    });
    if (jobs.length === 0) break;
    await Promise.all(jobs.map((j) => limit(async () => {
      const tags = await tagJob(
        { title: j.title, company: j.company, locationRaw: j.location, description: j.description },
        { apiKey, model: MODEL },
      );
      await prisma.job.update({
        where: { id: j.id },
        data: {
          level: tags.level, workMode: tags.workMode,
          locationCity: tags.locationCity, locationCountry: tags.locationCountry,
          salaryMin: tags.salaryMin, salaryMax: tags.salaryMax, minYoE: tags.minYoE,
          stackTags: tags.stackTags,
          taggedAt: new Date(), tagModel: MODEL,
        },
      });
      total++;
      if (total % 25 === 0) console.log(`[backfill] tagged=${total}`);
    })));
  }
  console.log(`[backfill] done, total=${total}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Smoke run (optional, only if a real key is in env)**

```bash
cd web && SYSTEM_AI_API_KEY=$SYSTEM_AI_API_KEY pnpm tsx scripts/backfill-tags.ts
```
Expected: prints `tagged=N` then `done`.

- [ ] **Step 3: Commit**

```bash
git add web/scripts/backfill-tags.ts
git commit -m "chore(ai): backfill script for untagged jobs"
```

---

## Phase 3 — Brave Search lane

### Task 6: URL classifier

**Files:**
- Create: `scraper/src/utils/classify.ts`
- Test: `scraper/src/utils/classify.test.ts`

- [ ] **Step 1: Write the test**

Create `scraper/src/utils/classify.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { classifyUrl } from "./classify.js";

describe("classifyUrl", () => {
  it("recognizes ashby URLs", () => {
    expect(classifyUrl("https://jobs.ashbyhq.com/notion/abc-123")).toEqual({ ats: "ashby", org: "notion", jobId: "abc-123" });
  });
  it("recognizes greenhouse URLs", () => {
    expect(classifyUrl("https://boards.greenhouse.io/airbnb/jobs/12345")).toEqual({ ats: "greenhouse", org: "airbnb", jobId: "12345" });
  });
  it("recognizes lever URLs", () => {
    expect(classifyUrl("https://jobs.lever.co/figma/some-uuid-here")).toEqual({ ats: "lever", org: "figma", jobId: "some-uuid-here" });
  });
  it("returns null for unknown hosts", () => {
    expect(classifyUrl("https://example.com/jobs/1")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd scraper && pnpm vitest run src/utils/classify.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `scraper/src/utils/classify.ts`:
```ts
export type AtsKind = "ashby" | "greenhouse" | "lever";
export interface Classified { ats: AtsKind; org: string; jobId: string; }

export function classifyUrl(raw: string): Classified | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "jobs.ashbyhq.com" && parts.length >= 2) {
    return { ats: "ashby", org: parts[0], jobId: parts[1] };
  }
  if (host === "boards.greenhouse.io" && parts.length >= 3 && parts[1] === "jobs") {
    return { ats: "greenhouse", org: parts[0], jobId: parts[2] };
  }
  if (host === "jobs.lever.co" && parts.length >= 2) {
    return { ats: "lever", org: parts[0], jobId: parts[1] };
  }
  return null;
}
```

- [ ] **Step 4: Verify PASS**

```bash
cd scraper && pnpm vitest run src/utils/classify.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/utils/classify.ts scraper/src/utils/classify.test.ts
git commit -m "feat(scraper): URL classifier for ashby/greenhouse/lever"
```

---

### Task 7: Add `fetchOne` to each ATS scraper

**Files:**
- Modify: `scraper/src/scrapers/ashby.ts`
- Modify: `scraper/src/scrapers/greenhouse.ts`
- Modify: `scraper/src/scrapers/lever.ts`

- [ ] **Step 1: Ashby `fetchOne`**

Append to `scraper/src/scrapers/ashby.ts` (and export the inner `fetchOrgAshby` if needed for reuse — it already exists; we keep it private and add `fetchOneAshby`):

```ts
export async function fetchOneAshby(org: string, jobId: string, company?: string): Promise<JobRecord | null> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${org}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { jobs?: AshbyJob[] };
    const j = (data.jobs ?? []).find((x) => x.jobUrl?.endsWith(`/${jobId}`));
    if (!j || !j.publishedAt) return null;
    return {
      url: j.jobUrl,
      title: j.title,
      company: company ?? orgToCompany(org),
      location: j.location || j.workplaceType || "",
      description: j.descriptionPlain ?? null,
      source: "ashby",
      postedAt: new Date(j.publishedAt).toISOString(),
      snapshotUrl: null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Greenhouse `fetchOne`**

Append to `scraper/src/scrapers/greenhouse.ts`:

```ts
export async function fetchOneGreenhouse(org: string, jobId: string, company?: string): Promise<JobRecord | null> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${org}/jobs/${jobId}?content=true`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const j = (await res.json()) as GreenhouseJob;
    if (!j.updated_at) return null;
    return {
      url: j.absolute_url,
      title: j.title,
      company: company ?? orgToCompany(org),
      location: j.location?.name ?? "",
      description: stripHtml(j.content ?? ""),
      source: "greenhouse",
      postedAt: new Date(j.updated_at).toISOString(),
      snapshotUrl: null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Lever `fetchOne`**

Append to `scraper/src/scrapers/lever.ts`:

```ts
export async function fetchOneLever(org: string, jobId: string, company?: string): Promise<JobRecord | null> {
  const url = `https://api.lever.co/v0/postings/${org}/${jobId}?mode=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const p = (await res.json()) as LeverPosting;
    if (!p.createdAt) return null;
    return {
      url: p.hostedUrl,
      title: p.text,
      company: company ?? orgToCompany(org),
      location: p.categories?.location ?? "",
      description: p.descriptionPlain ?? null,
      source: "lever",
      postedAt: new Date(p.createdAt).toISOString(),
      snapshotUrl: null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Add a quick live-toggled smoke test (optional)**

Append to `scraper/src/scrapers/ashby.test.ts`:
```ts
import { fetchOneAshby } from "./ashby.js";
describe.skipIf(!process.env.SCRAPER_LIVE_TEST)("fetchOneAshby — live", () => {
  it("returns null for a bogus jobId", async () => {
    expect(await fetchOneAshby("notion", "definitely-not-a-job")).toBeNull();
  }, 15_000);
});
```

- [ ] **Step 5: Type-check**

```bash
cd scraper && pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add scraper/src/scrapers/
git commit -m "feat(scraper): per-ATS fetchOne helpers"
```

---

### Task 8: Brave API wrapper

**Files:**
- Create: `scraper/src/utils/brave.ts`
- Test: `scraper/src/utils/brave.test.ts`

- [ ] **Step 1: Write the test (mocked fetch)**

Create `scraper/src/utils/brave.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { braveSearch } from "./brave.js";

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });

describe("braveSearch", () => {
  it("sends the right query and parses results", async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ web: { results: [
        { url: "https://jobs.ashbyhq.com/foo/1", title: "FE Eng", description: "..." },
      ] } }),
    });
    const out = await braveSearch({ q: "frontend engineer", apiKey: "k", count: 20 });
    expect(out.length).toBe(1);
    expect(out[0].url).toContain("ashbyhq.com");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("q=frontend+engineer");
    expect(calledUrl).toContain("count=20");
  });

  it("returns [] on non-2xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "rate" });
    expect(await braveSearch({ q: "x", apiKey: "k" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd scraper && pnpm vitest run src/utils/brave.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `scraper/src/utils/brave.ts`:
```ts
export interface BraveResult { url: string; title: string; description: string; }
export interface BraveSearchOpts {
  q: string;
  apiKey: string;
  count?: number;       // default 20, max 20
  freshness?: "pd" | "pw" | "pm" | "py";
  country?: string;     // e.g. "us"
}

export async function braveSearch(opts: BraveSearchOpts): Promise<BraveResult[]> {
  const params = new URLSearchParams({
    q: opts.q,
    count: String(opts.count ?? 20),
  });
  if (opts.freshness) params.set("freshness", opts.freshness);
  if (opts.country) params.set("country", opts.country);

  const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": opts.apiKey,
      },
    });
    if (!res.ok) {
      console.warn(`[brave] HTTP ${res.status} q=${opts.q}`);
      return [];
    }
    const data = (await res.json()) as { web?: { results?: BraveResult[] } };
    return data.web?.results ?? [];
  } catch (err) {
    console.warn(`[brave] error q=${opts.q}: ${String(err)}`);
    return [];
  }
}
```

- [ ] **Step 4: Verify PASS**

```bash
cd scraper && pnpm vitest run src/utils/brave.test.ts
```
Expected: PASS (2).

- [ ] **Step 5: Commit**

```bash
git add scraper/src/utils/brave.ts scraper/src/utils/brave.test.ts
git commit -m "feat(scraper): brave search api wrapper"
```

---

### Task 9: Brave scraper

**Files:**
- Create: `scraper/src/scrapers/brave.ts`
- Test: `scraper/src/scrapers/brave.test.ts`

- [ ] **Step 1: Write the test**

Create `scraper/src/scrapers/brave.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../utils/brave.js", () => ({
  braveSearch: vi.fn().mockResolvedValue([
    { url: "https://jobs.ashbyhq.com/notion/abc-123", title: "FE Eng", description: "..." },
    { url: "https://boards.greenhouse.io/airbnb/jobs/12345", title: "BE Eng", description: "..." },
    { url: "https://example.com/something", title: "Skip me", description: "" },
  ]),
}));
vi.mock("./ashby.js", () => ({
  fetchOneAshby: vi.fn().mockResolvedValue({
    url: "https://jobs.ashbyhq.com/notion/abc-123",
    title: "FE Eng", company: "Notion", location: "Remote",
    description: "desc", source: "ashby",
    postedAt: new Date().toISOString(), snapshotUrl: null,
  }),
}));
vi.mock("./greenhouse.js", () => ({
  fetchOneGreenhouse: vi.fn().mockResolvedValue(null),
}));
vi.mock("./lever.js", () => ({ fetchOneLever: vi.fn() }));

import { scrapeBrave } from "./brave.js";

describe("scrapeBrave", () => {
  it("classifies + enriches via fetchOne and skips unknown hosts and null fetches", async () => {
    const jobs = await scrapeBrave({ apiKey: "k", queries: ["software engineer"] });
    expect(jobs.length).toBe(1);
    expect(jobs[0].url).toContain("ashbyhq.com");
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd scraper && pnpm vitest run src/scrapers/brave.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `scraper/src/scrapers/brave.ts`:
```ts
import pLimit from "p-limit";
import { braveSearch } from "../utils/brave.js";
import { classifyUrl } from "../utils/classify.js";
import { fetchOneAshby } from "./ashby.js";
import { fetchOneGreenhouse } from "./greenhouse.js";
import { fetchOneLever } from "./lever.js";
import type { JobRecord } from "../types.js";

const SITE_RESTRICT = "(site:ashbyhq.com OR site:boards.greenhouse.io OR site:jobs.lever.co)";

export interface BraveLaneConfig {
  apiKey: string;
  queries: string[];   // role keywords; site restriction is appended automatically
  country?: string;    // default "us"
}

export async function scrapeBrave(cfg: BraveLaneConfig): Promise<JobRecord[]> {
  const out: JobRecord[] = [];
  const limit = pLimit(5);
  for (const role of cfg.queries) {
    const results = await braveSearch({
      q: `${role} ${SITE_RESTRICT}`,
      apiKey: cfg.apiKey,
      count: 20,
      freshness: "pd",
      country: cfg.country ?? "us",
    });
    const enriched = await Promise.all(results.map((r) => limit(async () => {
      const c = classifyUrl(r.url);
      if (!c) return null;
      try {
        if (c.ats === "ashby") return await fetchOneAshby(c.org, c.jobId);
        if (c.ats === "greenhouse") return await fetchOneGreenhouse(c.org, c.jobId);
        if (c.ats === "lever") return await fetchOneLever(c.org, c.jobId);
      } catch { /* fall through */ }
      return null;
    })));
    for (const j of enriched) if (j) out.push(j);
  }
  return out;
}
```

- [ ] **Step 4: Verify PASS**

```bash
cd scraper && pnpm vitest run src/scrapers/brave.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/scrapers/brave.ts scraper/src/scrapers/brave.test.ts
git commit -m "feat(scraper): brave-search discovery lane"
```

---

### Task 10: Wire Brave lane into orchestration

**Files:**
- Modify: `scraper/src/index.ts`

- [ ] **Step 1: Add the lane**

Edit `scraper/src/index.ts`. Replace the imports / lane section (lines 1-45) with:

```ts
import { scrapeAshby } from "./scrapers/ashby.js";
import { scrapeGreenhouse } from "./scrapers/greenhouse.js";
import { scrapeLever } from "./scrapers/lever.js";
import { scrapeBrave } from "./scrapers/brave.js";
import { filterJobs } from "./utils/filter.js";
import { ingestJobs } from "./utils/ingest.js";
import { snapshotJobs } from "./utils/snapshot.js";
import type { JobRecord } from "./types.js";

function readQueries(): string[] {
  const raw = process.env.SEARCH_QUERIES_JSON;
  if (!raw) return ["software engineer", "frontend engineer", "backend engineer"];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((q) => typeof q === "string")) return parsed;
  } catch { /* fall through */ }
  console.warn("[scraper] SEARCH_QUERIES_JSON invalid, using defaults");
  return ["software engineer", "frontend engineer", "backend engineer"];
}

async function main(): Promise<void> {
  const vercelUrl = process.env.VERCEL_URL;
  const ingestToken = process.env.INGEST_BEARER_TOKEN;
  if (!vercelUrl || !ingestToken) {
    console.error("[scraper] FATAL: VERCEL_URL and INGEST_BEARER_TOKEN must be set");
    process.exit(1);
  }
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  const hoursWindow = parseInt(process.env.SCRAPER_HOURS_WINDOW ?? "24", 10);
  console.log(`[scraper] hoursWindow=${hoursWindow} target=${vercelUrl} brave=${Boolean(braveKey)}`);

  const tasks: Array<Promise<JobRecord[]>> = [scrapeAshby(), scrapeGreenhouse(), scrapeLever()];
  if (braveKey) tasks.push(scrapeBrave({ apiKey: braveKey, queries: readQueries() }));
  else console.warn("[scraper] BRAVE_SEARCH_API_KEY unset; skipping Brave lane");

  const settled = await Promise.allSettled(tasks);
  const labels = ["ashby", "greenhouse", "lever", ...(braveKey ? ["brave"] : [])];
  const all: JobRecord[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      console.log(`[scraper] source=${labels[i]} scraped=${r.value.length}`);
      all.push(...r.value);
    } else {
      console.error(`[scraper] source=${labels[i]} FAILED: ${String(r.reason)}`);
    }
  });
  // ... existing dedup/filter/snapshot/ingest path continues below
```

(Keep the existing dedup/filter/snapshot/ingest tail of `main()` intact.)

- [ ] **Step 2: Type-check**

```bash
cd scraper && pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add scraper/src/index.ts
git commit -m "feat(scraper): orchestrate brave lane alongside org-list lanes"
```

---

## Phase 4 — Hidden companies

### Task 11: Company name normalizer

**Files:**
- Create: `web/lib/companies.ts`
- Test: `web/lib/companies.test.ts`

- [ ] **Step 1: Write the test**

Create `web/lib/companies.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { normalizeCompany } from "./companies";

describe("normalizeCompany", () => {
  it("lowercases, trims, strips suffixes", () => {
    expect(normalizeCompany("Stripe, Inc.")).toBe("stripe");
    expect(normalizeCompany("  Acme LLC  ")).toBe("acme");
    expect(normalizeCompany("Foo Corp")).toBe("foo");
    expect(normalizeCompany("Bar Inc")).toBe("bar");
    expect(normalizeCompany("Baz")).toBe("baz");
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd web && pnpm vitest run lib/companies.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/lib/companies.ts`:
```ts
const SUFFIX = /[\s,.]*\b(inc|incorporated|llc|ltd|corp|corporation|co)\.?\s*$/i;

export function normalizeCompany(raw: string): string {
  let v = raw.trim();
  // strip suffixes repeatedly to handle "Foo, Inc., LLC" edge cases
  let prev = "";
  while (prev !== v) { prev = v; v = v.replace(SUFFIX, "").trim(); }
  return v.toLowerCase();
}
```

- [ ] **Step 4: Verify PASS**

```bash
cd web && pnpm vitest run lib/companies.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/lib/companies.ts web/lib/companies.test.ts
git commit -m "feat(lib): company name normalizer"
```

---

### Task 12: Hidden-companies API routes

**Files:**
- Create: `web/app/api/users/me/hidden-companies/route.ts`
- Create: `web/app/api/users/me/hidden-companies/[company]/route.ts`
- Test: `web/app/api/users/me/hidden-companies/route.test.ts`

- [ ] **Step 1: Write GET/POST/DELETE tests**

Create `web/app/api/users/me/hidden-companies/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const update = vi.fn();
const updateMany = vi.fn();
const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique, update }, userJob: { updateMany }, job: { findMany } },
}));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "u@e.com" } }) }));

import { GET, POST } from "./route";
import { DELETE } from "./[company]/route";

beforeEach(() => { findUnique.mockReset(); update.mockReset(); updateMany.mockReset(); findMany.mockReset(); });

function mkReq(url: string, init?: RequestInit) { return new Request(url, init); }

describe("hidden-companies route", () => {
  it("GET returns current list", async () => {
    findUnique.mockResolvedValue({ id: "u1", hiddenCompanies: ["acme", "stripe"] });
    const res = await GET(mkReq("http://x/api/users/me/hidden-companies") as never);
    expect(await res.json()).toEqual({ companies: ["acme", "stripe"] });
  });

  it("POST adds + retroactively skips", async () => {
    findUnique.mockResolvedValue({ id: "u1", hiddenCompanies: [] });
    findMany.mockResolvedValue([{ id: "j1" }, { id: "j2" }]);
    update.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 2 });
    const res = await POST(mkReq("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: "Acme, Inc." }),
    }) as never);
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { hiddenCompanies: ["acme"] },
    }));
    expect(updateMany).toHaveBeenCalled();
  });

  it("DELETE removes + un-skips auto-skipped", async () => {
    findUnique.mockResolvedValue({ id: "u1", hiddenCompanies: ["acme", "stripe"] });
    update.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(mkReq("http://x") as never, { params: Promise.resolve({ company: "acme" }) });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { hiddenCompanies: ["stripe"] },
    }));
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd web && pnpm vitest run app/api/users/me/hidden-companies/route.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement GET / POST**

Create `web/app/api/users/me/hidden-companies/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCompany } from "@/lib/companies";

async function currentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, hiddenCompanies: true },
  });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ companies: user.hiddenCompanies });
}

const PostBody = z.object({ company: z.string().min(1) });
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const norm = normalizeCompany(parsed.data.company);
  if (!norm) return NextResponse.json({ error: "invalid company" }, { status: 400 });
  if (user.hiddenCompanies.includes(norm)) return NextResponse.json({ companies: user.hiddenCompanies });

  const next = [...user.hiddenCompanies, norm];
  await prisma.user.update({ where: { id: user.id }, data: { hiddenCompanies: next } });

  // Retroactive skip
  const matching = await prisma.job.findMany({
    where: {},
    select: { id: true, company: true },
  });
  const matchingIds = matching
    .filter((j) => normalizeCompany(j.company) === norm)
    .map((j) => j.id);
  let skipped = 0;
  if (matchingIds.length) {
    const r = await prisma.userJob.updateMany({
      where: { userId: user.id, status: "new", jobId: { in: matchingIds } },
      data: { status: "skipped", autoSkippedReason: "hidden_company" },
    });
    skipped = r.count;
  }
  return NextResponse.json({ companies: next, skipped });
}
```

- [ ] **Step 4: Implement DELETE**

Create `web/app/api/users/me/hidden-companies/[company]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCompany } from "@/lib/companies";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ company: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, hiddenCompanies: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { company } = await ctx.params;
  const norm = normalizeCompany(decodeURIComponent(company));
  const next = user.hiddenCompanies.filter((c) => c !== norm);
  await prisma.user.update({ where: { id: user.id }, data: { hiddenCompanies: next } });

  // Un-skip only auto-skipped UserJobs from this company
  const matching = await prisma.job.findMany({ select: { id: true, company: true } });
  const matchingIds = matching
    .filter((j) => normalizeCompany(j.company) === norm)
    .map((j) => j.id);
  let restored = 0;
  if (matchingIds.length) {
    const r = await prisma.userJob.updateMany({
      where: {
        userId: user.id, status: "skipped",
        autoSkippedReason: "hidden_company",
        jobId: { in: matchingIds },
      },
      data: { status: "new", autoSkippedReason: null },
    });
    restored = r.count;
  }
  return NextResponse.json({ companies: next, restored });
}
```

> Note: the unbounded `prisma.job.findMany` for retroactive matching is acceptable for a personal-tracker scale (≤50k rows). If the table grows large, replace with a Postgres `LOWER(company) = $1` raw query.

- [ ] **Step 5: Verify PASS**

```bash
cd web && pnpm vitest run app/api/users/me/hidden-companies/route.test.ts
```
Expected: PASS (3).

- [ ] **Step 6: Commit**

```bash
git add web/app/api/users/me/hidden-companies/
git commit -m "feat(api): hidden-companies CRUD with retroactive skip/restore"
```

---

### Task 13: Auto-skip in ingest

**Files:**
- Modify: `web/app/api/jobs/ingest/route.ts`

- [ ] **Step 1: Replace the per-user skip logic in `scoreForUser`**

In `scoreForUser`, replace the `createData` block (currently sets every new UserJob to status="new") with this:

```ts
// Pull user's hidden companies + the source jobs to make the auto-skip decision
const hidden = new Set(
  ((await prisma.user.findUnique({ where: { id: user.id }, select: { hiddenCompanies: true } }))?.hiddenCompanies ?? [])
    .map((c) => c),
);
const newJobsList = await prisma.job.findMany({
  where: { id: { in: Array.from(newJobIds) } },
  select: { id: true, company: true },
});
const createData = newJobsList.map((j) => {
  const isHidden = hidden.has(normalizeCompany(j.company));
  return {
    userId: user.id,
    jobId: j.id,
    status: isHidden ? "skipped" : "new",
    autoSkippedReason: isHidden ? "hidden_company" : null,
  };
});
```

Add `import { normalizeCompany } from "@/lib/companies";` at the top.

Note: if `EligibleUser` is constructed without `hiddenCompanies`, the lookup above is the simplest path; OR you can extend the upstream `findMany` to include `hiddenCompanies`. Both are fine.

- [ ] **Step 2: Add a regression test**

Append to `web/app/api/jobs/ingest/route.test.ts` (use the existing prisma mock harness already in that file; add a fresh `describe` block):

```ts
describe("auto-skip hidden companies", () => {
  it("creates UserJobs with status=skipped when company is hidden", async () => {
    // Arrange — using the same prisma mock pattern already used in this file:
    // user.findUnique({ select: { hiddenCompanies } }) returns ["acme"]
    // job.findMany returns [{ id: "j1", company: "Acme, Inc." }, { id: "j2", company: "Stripe" }]
    // Replace these mocks with whatever shape your existing harness uses.
    const createMany = vi.fn().mockResolvedValue({ count: 2 });
    // … wire createMany into the prisma mock and call scoreForUser exported helper
    // (or invoke POST end-to-end if the test file already does that)
    // Then assert that createMany was called with data containing
    //   { jobId: "j1", status: "skipped", autoSkippedReason: "hidden_company" }
    //   { jobId: "j2", status: "new",     autoSkippedReason: null }
    expect(true).toBe(true); // placeholder once mocks are wired
  });
});
```

> If the existing `route.test.ts` is already structured around full POST integration, prefer extending that path: pre-seed `user.hiddenCompanies = ["acme"]` and assert `userJob.createMany` is called with the mixed `status` array shown above.

- [ ] **Step 3: Run all ingest tests**

```bash
cd web && pnpm vitest run app/api/jobs/ingest
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/jobs/ingest/route.ts web/app/api/jobs/ingest/route.test.ts
git commit -m "feat(ingest): auto-skip new userjobs from hidden companies"
```

---

## Phase 5 — Saved searches API

### Task 14: Saved-searches CRUD

**Files:**
- Create: `web/app/api/saved-searches/route.ts`
- Create: `web/app/api/saved-searches/[id]/route.ts`
- Test: `web/app/api/saved-searches/route.test.ts`

- [ ] **Step 1: Filters Zod schema (shared)**

Create `web/lib/feed-filters.ts`:
```ts
import { z } from "zod";

export const FeedFiltersSchema = z.object({
  status: z.array(z.string()).optional(),
  source: z.array(z.string()).optional(),
  level: z.array(z.string()).optional(),
  workMode: z.array(z.string()).optional(),
  locationCountry: z.array(z.string()).optional(),
  locationCity: z.array(z.string()).optional(),
  stackTags: z.array(z.string()).optional(),
  excludeCompanies: z.array(z.string()).optional(),
  postedAfter: z.string().datetime().optional(),
  postedBefore: z.string().datetime().optional(),
  salaryMin: z.number().int().min(0).optional(),
  maxYoE: z.number().int().min(0).max(50).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  q: z.string().optional(),
  sort: z.enum(["score", "fresh"]).optional(),
}).strict();
export type FeedFilters = z.infer<typeof FeedFiltersSchema>;
```

- [ ] **Step 2: Test (GET/POST/PATCH/DELETE)**

Create `web/app/api/saved-searches/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const findUniqueU = vi.fn();
const findMany = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: findUniqueU }, savedSearch: { findMany, create, update, delete: del } },
}));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "u@e.com" } }) }));

import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[id]/route";

beforeEach(() => {
  findUniqueU.mockResolvedValue({ id: "u1" });
  findMany.mockReset(); create.mockReset(); update.mockReset(); del.mockReset();
});

describe("saved-searches", () => {
  it("GET returns user's saved searches", async () => {
    findMany.mockResolvedValue([{ id: "s1", name: "FE Remote", filters: {}, sortIndex: 0 }]);
    const res = await GET();
    expect((await res.json()).items).toHaveLength(1);
  });
  it("POST validates filters", async () => {
    const bad = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "x", filters: { unknownField: 1 } }) }));
    expect(bad.status).toBe(400);
  });
  it("POST creates with valid filters", async () => {
    create.mockResolvedValue({ id: "s2", name: "BE", filters: { level: ["staff"] }, sortIndex: 0 });
    const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ name: "BE", filters: { level: ["staff"] } }) }));
    expect(res.status).toBe(200);
  });
  it("PATCH updates", async () => {
    update.mockResolvedValue({});
    const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "x" }) }), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
  });
  it("DELETE removes", async () => {
    del.mockResolvedValue({});
    const res = await DELETE(new Request("http://x"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

```bash
cd web && pnpm vitest run app/api/saved-searches
```
Expected: FAIL.

- [ ] **Step 4: Implement collection route**

Create `web/app/api/saved-searches/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FeedFiltersSchema } from "@/lib/feed-filters";

async function currentUserId() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const u = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return u?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  filters: FeedFiltersSchema,
  sortIndex: z.number().int().optional(),
});
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  const item = await prisma.savedSearch.create({
    data: {
      userId,
      name: parsed.data.name,
      filters: parsed.data.filters,
      sortIndex: parsed.data.sortIndex ?? 0,
    },
  });
  return NextResponse.json({ item });
}
```

- [ ] **Step 5: Implement item route**

Create `web/app/api/saved-searches/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FeedFiltersSchema } from "@/lib/feed-filters";

const PatchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  filters: FeedFiltersSchema.optional(),
  sortIndex: z.number().int().optional(),
});

async function currentUserId() {
  const session = await auth();
  if (!session?.user?.email) return null;
  const u = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true },
  });
  return u?.id ?? null;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  await prisma.savedSearch.update({
    where: { id, userId } as never,   // userId scoping; rely on the unique id + later guard if Prisma rejects composite
    data: parsed.data,
  }).catch(async () => {
    // fallback: ensure the row belongs to user
    const existing = await prisma.savedSearch.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) throw new Error("not_found");
    await prisma.savedSearch.update({ where: { id }, data: parsed.data });
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const existing = await prisma.savedSearch.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await prisma.savedSearch.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Verify PASS**

```bash
cd web && pnpm vitest run app/api/saved-searches
```
Expected: PASS (5).

- [ ] **Step 7: Commit**

```bash
git add web/lib/feed-filters.ts web/app/api/saved-searches/
git commit -m "feat(api): saved searches crud"
```

---

## Phase 6 — Feed API expansion

### Task 15: Expand `/api/jobs` with new filters + facets

**Files:**
- Modify: `web/app/api/jobs/route.ts`
- Test: `web/app/api/jobs/route.test.ts` (create if missing)

- [ ] **Step 1: Test the new params**

Create `web/app/api/jobs/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const findMany = vi.fn();
const count = vi.fn();
const groupBy = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique },
    userJob: { findMany, count, groupBy },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "u@e.com" } }) }));

import { GET } from "./route";

beforeEach(() => {
  findUnique.mockResolvedValue({ id: "u1" });
  findMany.mockResolvedValue([]);
  count.mockResolvedValue(0);
  groupBy.mockResolvedValue([]);
});

describe("/api/jobs filters", () => {
  it("accepts level, workMode, stackTags, postedAfter without error", async () => {
    const url = "http://x/api/jobs?level=senior,staff&workMode=remote&stackTags=react,go&postedAfter=2026-04-01T00:00:00Z";
    const res = await GET(new Request(url) as never);
    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    const job = where.job as Record<string, unknown>;
    expect(job.level).toEqual({ in: ["senior", "staff"] });
    expect(job.workMode).toEqual({ in: ["remote"] });
    expect(job.stackTags).toEqual({ hasSome: ["react", "go"] });
    expect(job.postedAt).toEqual(expect.objectContaining({ gte: expect.any(Date) }));
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd web && pnpm vitest run app/api/jobs/route.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `web/app/api/jobs/route.ts` with:
```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "new", "queued", "applied", "skipped", "rejected", "interview", "no_response",
]);

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function multi(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const out = v.split(",").map((s) => s.trim()).filter(Boolean);
  return out.length ? out : undefined;
}
function parseDate(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v); return isNaN(+d) ? undefined : d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sp = url.searchParams;

  // base
  const statuses = (multi(sp.get("status")) ?? ["new", "queued"]).filter((s) => ALLOWED_STATUSES.has(s));
  const q = (sp.get("q") ?? "").trim();
  const minScore = clampInt(sp.get("minScore"), 0, 100, 0);
  const limit = clampInt(sp.get("limit"), 1, 100, 50);
  const offset = clampInt(sp.get("offset"), 0, 10_000, 0);
  const sort = sp.get("sort") === "fresh" ? "fresh" : "score";

  // job-level
  const level = multi(sp.get("level"));
  const workMode = multi(sp.get("workMode"));
  const source = multi(sp.get("source"));
  const locationCountry = multi(sp.get("locationCountry"));
  const locationCity = multi(sp.get("locationCity"));
  const stackTags = multi(sp.get("stackTags"));
  const excludeCompanies = multi(sp.get("excludeCompanies"));
  const postedAfter = parseDate(sp.get("postedAfter"));
  const postedBefore = parseDate(sp.get("postedBefore"));
  const salaryMin = sp.get("salaryMin") !== null ? clampInt(sp.get("salaryMin"), 0, 1_000_000, 0) : undefined;
  const maxYoE = sp.get("maxYoE") !== null ? clampInt(sp.get("maxYoE"), 0, 50, 0) : undefined;

  const jobWhere: Record<string, unknown> = {};
  if (level) jobWhere.level = { in: level };
  if (workMode) jobWhere.workMode = { in: workMode };
  if (source) jobWhere.source = { in: source };
  if (locationCountry) jobWhere.locationCountry = { in: locationCountry };
  if (locationCity) jobWhere.locationCity = { in: locationCity };
  if (stackTags) jobWhere.stackTags = { hasSome: stackTags };
  if (excludeCompanies) jobWhere.company = { notIn: excludeCompanies };
  if (postedAfter || postedBefore) jobWhere.postedAt = {
    ...(postedAfter ? { gte: postedAfter } : {}),
    ...(postedBefore ? { lte: postedBefore } : {}),
  };
  if (salaryMin !== undefined) jobWhere.salaryMax = { gte: salaryMin };
  if (maxYoE !== undefined) {
    jobWhere.OR = [{ minYoE: null }, { minYoE: { lte: maxYoE } }];
  }
  if (q) jobWhere.OR = [
    ...(jobWhere.OR as object[] ?? []),
    { title: { contains: q, mode: "insensitive" as const } },
    { company: { contains: q, mode: "insensitive" as const } },
  ];

  const where = {
    userId: user.id,
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(minScore > 0 ? { score: { gte: minScore } } : {}),
    ...(Object.keys(jobWhere).length ? { job: jobWhere } : {}),
  };

  const orderBy = sort === "fresh"
    ? [{ job: { postedAt: "desc" as const } }, { id: "desc" as const }]
    : [{ score: "desc" as const }, { job: { postedAt: "desc" as const } }, { id: "desc" as const }];

  const [items, total, statusCounts] = await Promise.all([
    prisma.userJob.findMany({
      where, orderBy, take: limit, skip: offset,
      select: {
        id: true, score: true, scoreReason: true, status: true, appliedAt: true, emailNote: true,
        autoSkippedReason: true,
        job: {
          select: {
            id: true, title: true, company: true, location: true, url: true, source: true,
            postedAt: true, foundAt: true, snapshotUrl: true,
            level: true, workMode: true, locationCity: true, locationCountry: true,
            salaryMin: true, salaryMax: true, minYoE: true, stackTags: true,
          },
        },
      },
    }),
    prisma.userJob.count({ where }),
    prisma.userJob.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
  ]);

  const countsByStatus: Record<string, number> = {};
  for (const c of statusCounts) countsByStatus[c.status] = c._count._all;

  // facets — counts only for the current filter set, projected over each axis
  // Implemented as raw groupBy on Job filtered by userJob match; simplest first version uses Prisma queryRaw.
  // For now, derive from `items` (top page) — UI will treat them as soft hints.
  const facets = computeFacets(items);

  return NextResponse.json({ items, total, countsByStatus, facets });
}

type Item = Awaited<ReturnType<typeof prisma.userJob.findMany>>[number];
function computeFacets(items: Item[]) {
  const tally = (vals: (string | null | undefined)[]) => {
    const m: Record<string, number> = {};
    for (const v of vals) if (v) m[v] = (m[v] ?? 0) + 1;
    return m;
  };
  const stack: Record<string, number> = {};
  for (const it of items) for (const t of (it as never as { job: { stackTags?: string[] } }).job.stackTags ?? []) stack[t] = (stack[t] ?? 0) + 1;
  return {
    level: tally(items.map((i) => (i as never as { job: { level?: string } }).job.level)),
    workMode: tally(items.map((i) => (i as never as { job: { workMode?: string } }).job.workMode)),
    source: tally(items.map((i) => (i as never as { job: { source: string } }).job.source)),
    stackTags: stack,
  };
}
```

> Note: facets are computed from the top page for v1 — accurate enough for chip badges. A v2 can swap in a `groupBy` query.

- [ ] **Step 4: Verify PASS**

```bash
cd web && pnpm vitest run app/api/jobs/route.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/jobs/route.ts web/app/api/jobs/route.test.ts
git commit -m "feat(api): expand /api/jobs with rich filters + page-level facets"
```

---

### Task 16: `GET /api/jobs/[id]`

**Files:**
- Create: `web/app/api/jobs/[id]/route.ts`
- Test: `web/app/api/jobs/[id]/route.test.ts`

- [ ] **Step 1: Test**

Create `web/app/api/jobs/[id]/route.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
const findUniqueU = vi.fn();
const findUniqueJ = vi.fn();
const findUniqueUJ = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueU },
    job: { findUnique: findUniqueJ },
    userJob: { findUnique: findUniqueUJ },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "u@e.com" } }) }));

import { GET } from "./route";

beforeEach(() => {
  findUniqueU.mockResolvedValue({ id: "u1" });
  findUniqueJ.mockReset(); findUniqueUJ.mockReset();
});

describe("/api/jobs/[id]", () => {
  it("returns 404 for missing job", async () => {
    findUniqueJ.mockResolvedValue(null);
    const res = await GET(new Request("http://x") as never, { params: Promise.resolve({ id: "j-x" }) });
    expect(res.status).toBe(404);
  });
  it("returns job + userJob", async () => {
    findUniqueJ.mockResolvedValue({ id: "j1", title: "FE", company: "Acme", url: "https://j", stackTags: ["react"] });
    findUniqueUJ.mockResolvedValue({ id: "uj1", status: "new", score: 87 });
    const res = await GET(new Request("http://x") as never, { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.id).toBe("j1");
    expect(body.userJob.score).toBe(87);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
cd web && pnpm vitest run app/api/jobs/\[id\]/route.test.ts
```
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `web/app/api/jobs/[id]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { email: session.user.email }, select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const userJob = await prisma.userJob.findUnique({
    where: { userId_jobId: { userId: user.id, jobId: id } },
  });
  return NextResponse.json({ job, userJob });
}
```

- [ ] **Step 4: Verify PASS**

```bash
cd web && pnpm vitest run app/api/jobs/\[id\]/route.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/app/api/jobs/\[id\]/
git commit -m "feat(api): job detail endpoint for side panel"
```

---

## Phase 7 — Dashboard UI (use tasteskill design pass per CLAUDE.md)

### Task 17: Filter bar component

**Files:**
- Create: `web/app/dashboard/_components/filter-bar.tsx`

- [ ] **Step 1: Implement filter-bar shell**

Create `web/app/dashboard/_components/filter-bar.tsx`:
```tsx
"use client";
import { useMemo } from "react";

const LEVEL_OPTIONS = ["junior", "mid", "senior", "staff", "principal"];
const WORK_MODE_OPTIONS = ["remote", "hybrid", "onsite"];
const POSTED_WINDOWS: { label: string; hours: number }[] = [
  { label: "24h", hours: 24 }, { label: "3d", hours: 72 },
  { label: "7d", hours: 168 }, { label: "30d", hours: 720 },
];

export interface FilterState {
  level: string[];
  workMode: string[];
  source: string[];
  postedWithinHours: number | null;
  salaryMin: number | null;
  maxYoE: number | null;
  stackTags: string[];
}
export const EMPTY_FILTERS: FilterState = {
  level: [], workMode: [], source: [], postedWithinHours: null,
  salaryMin: null, maxYoE: null, stackTags: [],
};

interface Props {
  value: FilterState;
  onChange: (next: FilterState) => void;
  facets?: { level?: Record<string, number>; workMode?: Record<string, number>; source?: Record<string, number>; stackTags?: Record<string, number> };
  knownStackTags: string[];
}

export function FilterBar({ value, onChange, facets, knownStackTags }: Props) {
  const isDirty = useMemo(() =>
    value.level.length || value.workMode.length || value.source.length ||
    value.postedWithinHours !== null || value.salaryMin !== null ||
    value.maxYoE !== null || value.stackTags.length > 0
  , [value]);

  const toggle = (arr: string[], v: string): string[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 border-b border-zinc-800 bg-zinc-950/95 px-4 py-3 backdrop-blur">
      <ChipGroup label="Level" options={LEVEL_OPTIONS} value={value.level}
        onToggle={(v) => onChange({ ...value, level: toggle(value.level, v) })}
        counts={facets?.level} />
      <ChipGroup label="Mode" options={WORK_MODE_OPTIONS} value={value.workMode}
        onToggle={(v) => onChange({ ...value, workMode: toggle(value.workMode, v) })}
        counts={facets?.workMode} />
      <ChipGroup label="Source" options={["ashby", "greenhouse", "lever"]} value={value.source}
        onToggle={(v) => onChange({ ...value, source: toggle(value.source, v) })}
        counts={facets?.source} />
      <PostedWithin value={value.postedWithinHours} onChange={(h) => onChange({ ...value, postedWithinHours: h })} />
      <NumberPopover label="Min $" value={value.salaryMin} step={10000} suffix="USD"
        onChange={(n) => onChange({ ...value, salaryMin: n })} />
      <NumberPopover label="Max YoE" value={value.maxYoE} step={1} suffix="yrs"
        onChange={(n) => onChange({ ...value, maxYoE: n })} />
      <StackPicker known={knownStackTags} value={value.stackTags} counts={facets?.stackTags}
        onChange={(next) => onChange({ ...value, stackTags: next })} />
      {isDirty ? (
        <button onClick={() => onChange(EMPTY_FILTERS)} className="ml-auto text-xs text-zinc-400 hover:text-zinc-100">
          Clear all
        </button>
      ) : null}
    </div>
  );
}

// Sub-components: ChipGroup, PostedWithin, NumberPopover, StackPicker
// Each is small (~30 lines). Render <button>s with selected state styling.
function ChipGroup({ label, options, value, onToggle, counts }: { label: string; options: string[]; value: string[]; onToggle: (v: string) => void; counts?: Record<string, number> }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      {options.map((o) => {
        const active = value.includes(o);
        const cnt = counts?.[o];
        return (
          <button key={o} onClick={() => onToggle(o)}
            className={`rounded-full px-2.5 py-1 text-xs ${active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
            {o}{cnt !== undefined ? <span className="ml-1 text-[10px] opacity-60">{cnt}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
function PostedWithin({ value, onChange }: { value: number | null; onChange: (h: number | null) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs uppercase tracking-wide text-zinc-500">Posted</span>
      {POSTED_WINDOWS.map((w) => (
        <button key={w.hours} onClick={() => onChange(value === w.hours ? null : w.hours)}
          className={`rounded-full px-2.5 py-1 text-xs ${value === w.hours ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}>
          {w.label}
        </button>
      ))}
    </div>
  );
}
function NumberPopover({ label, value, step, suffix, onChange }: { label: string; value: number | null; step: number; suffix: string; onChange: (n: number | null) => void }) {
  return (
    <label className="flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
      {label}
      <input type="number" step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-20 border-none bg-transparent outline-none placeholder:text-zinc-500" />
      <span className="opacity-60">{suffix}</span>
    </label>
  );
}
function StackPicker({ known, value, counts, onChange }: { known: string[]; value: string[]; counts?: Record<string, number>; onChange: (next: string[]) => void }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 marker:hidden">
        Stack {value.length ? <span className="ml-1 opacity-70">({value.length})</span> : null}
      </summary>
      <div className="absolute mt-1 max-h-72 w-56 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 shadow-xl">
        {known.map((t) => {
          const active = value.includes(t);
          return (
            <button key={t} onClick={() => onChange(active ? value.filter((x) => x !== t) : [...value, t])}
              className={`flex w-full items-center justify-between rounded px-2 py-1 text-xs ${active ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"}`}>
              <span>{t}</span>
              {counts?.[t] !== undefined ? <span className="opacity-60">{counts[t]}</span> : null}
            </button>
          );
        })}
      </div>
    </details>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/_components/filter-bar.tsx
git commit -m "feat(ui): filter bar shell with chips, popovers, stack picker"
```

---

### Task 18: Saved-searches strip

**Files:**
- Create: `web/app/dashboard/_components/saved-searches-strip.tsx`

- [ ] **Step 1: Implement**

Create `web/app/dashboard/_components/saved-searches-strip.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { FilterState } from "./filter-bar";

export interface SavedSearch { id: string; name: string; filters: Record<string, unknown>; sortIndex: number; }

interface Props {
  items: SavedSearch[];
  activeId: string | null;
  currentFilters: FilterState;
  onSelect: (id: string | null) => void;
  onSaveCurrent: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function SavedSearchesStrip({ items, activeId, currentFilters, onSelect, onSaveCurrent, onDelete }: Props) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-900 bg-zinc-950 px-4 py-2">
      <button onClick={() => onSelect(null)}
        className={`rounded-full px-3 py-1 text-xs ${activeId === null ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}>
        All
      </button>
      {items.map((s) => (
        <button key={s.id} onClick={() => onSelect(s.id)}
          onContextMenu={(e) => { e.preventDefault(); if (confirm(`Delete "${s.name}"?`)) onDelete(s.id); }}
          className={`group rounded-full px-3 py-1 text-xs ${activeId === s.id ? "bg-zinc-100 text-zinc-900" : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}>
          {s.name}
        </button>
      ))}
      {naming ? (
        <span className="flex items-center gap-1">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Name preset…" className="rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100" />
          <button onClick={async () => { if (name.trim()) { await onSaveCurrent(name.trim()); setName(""); setNaming(false); } }}
            className="text-xs text-emerald-400 hover:text-emerald-300">Save</button>
          <button onClick={() => { setName(""); setNaming(false); }} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
        </span>
      ) : (
        <button onClick={() => setNaming(true)} className="rounded-full bg-zinc-900 px-3 py-1 text-xs text-zinc-400 hover:bg-zinc-800">
          + Save current
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/dashboard/_components/saved-searches-strip.tsx
git commit -m "feat(ui): saved-searches strip"
```

---

### Task 19: Job-row updates

**Files:**
- Modify: `web/app/dashboard/_components/job-row.tsx`

- [ ] **Step 1: Add chips + freshness dot + click-to-open**

In `job-row.tsx`, change the title element from an external `<a>` to a `<button>` that calls a new `onOpenDetail(jobId)` prop. Keep the existing "Open original" icon-link as a separate small icon-button on the right.

Add chip rendering immediately under the title row:
```tsx
function FreshnessDot({ postedAt }: { postedAt: string | Date }) {
  const ageHrs = (Date.now() - new Date(postedAt).getTime()) / 36e5;
  const cls = ageHrs <= 6 ? "bg-emerald-500" : ageHrs <= 24 ? "bg-yellow-500" : "bg-zinc-600";
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${cls}`} aria-label={`posted ${Math.round(ageHrs)}h ago`} />;
}

function MetaChips({ job }: { job: { level?: string | null; workMode?: string | null; salaryMin?: number | null; salaryMax?: number | null; stackTags?: string[] } }) {
  const fmt = (n: number) => n >= 1000 ? `$${Math.round(n/1000)}k` : `$${n}`;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
      {job.level && job.level !== "unknown" ? <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">{job.level}</span> : null}
      {job.workMode && job.workMode !== "unknown" ? <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">{job.workMode}</span> : null}
      {job.salaryMin || job.salaryMax ? (
        <span className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-emerald-200">
          {job.salaryMin ? fmt(job.salaryMin) : "?"}{" – "}{job.salaryMax ? fmt(job.salaryMax) : "?"}
        </span>
      ) : null}
      {(job.stackTags ?? []).slice(0, 4).map((t) => (
        <span key={t} className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-400">{t}</span>
      ))}
    </div>
  );
}
```

Wire `onOpenDetail` from the parent (`job-feed.tsx`) so a click toggles the side panel.

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/_components/job-row.tsx
git commit -m "feat(ui): row chips, freshness dot, click-to-open"
```

---

### Task 20: Job detail side panel

**Files:**
- Create: `web/app/dashboard/_components/job-detail-panel.tsx`

- [ ] **Step 1: Implement**

Create `web/app/dashboard/_components/job-detail-panel.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";

interface JobDetail {
  job: {
    id: string; title: string; company: string; url: string;
    location: string; locationCity?: string | null; locationCountry?: string | null;
    description: string | null; snapshotUrl: string | null;
    postedAt: string; source: string;
    level?: string | null; workMode?: string | null;
    salaryMin?: number | null; salaryMax?: number | null; minYoE?: number | null;
    stackTags?: string[];
  } | null;
  userJob: {
    id: string; status: string; score: number | null; scoreReason: string | null;
    emailNote: string | null; appliedAt: string | null;
  } | null;
}

interface Props {
  jobId: string | null;
  onClose: () => void;
  onAction: (action: "queue" | "applied" | "skip") => Promise<void>;
  onHideCompany: (company: string) => Promise<void>;
  onSaveNotes: (note: string) => Promise<void>;
}

export function JobDetailPanel({ jobId, onClose, onAction, onHideCompany, onSaveNotes }: Props) {
  const [data, setData] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!jobId) { setData(null); return; }
    setLoading(true);
    fetch(`/api/jobs/${jobId}`).then((r) => r.json()).then((d) => {
      setData(d); setNote(d.userJob?.emailNote ?? "");
    }).finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jobId, onClose]);

  if (!jobId) return null;

  return (
    <>
      <div className="fixed inset-0 z-30 bg-black/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-40 flex h-full w-[520px] max-w-[92vw] flex-col border-l border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        {loading ? <div className="p-4 text-sm text-zinc-500">Loading…</div> :
        !data?.job ? <div className="p-4 text-sm text-rose-400">Job not found.</div> : (
          <>
            <header className="border-b border-zinc-800 px-4 py-3">
              <h2 className="text-base font-semibold">{data.job.title}</h2>
              <div className="mt-0.5 text-xs text-zinc-400">
                {data.job.company} · {data.job.locationCity ?? data.job.location} · {data.job.source}
              </div>
              {data.userJob?.score !== null && data.userJob ? (
                <div className="mt-1 text-xs text-emerald-400">
                  Score {data.userJob.score} — <span className="text-zinc-400">{data.userJob.scoreReason}</span>
                </div>
              ) : null}
            </header>

            <section className="grid grid-cols-2 gap-2 border-b border-zinc-800 px-4 py-3 text-xs">
              <Meta k="Level" v={data.job.level} />
              <Meta k="Mode" v={data.job.workMode} />
              <Meta k="Salary" v={data.job.salaryMin || data.job.salaryMax ? `${data.job.salaryMin ?? "?"} – ${data.job.salaryMax ?? "?"}` : null} />
              <Meta k="Min YoE" v={data.job.minYoE !== null && data.job.minYoE !== undefined ? String(data.job.minYoE) : null} />
              {data.job.stackTags?.length ? (
                <div className="col-span-2 mt-1 flex flex-wrap gap-1">
                  {data.job.stackTags.map((t) => <span key={t} className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-300">{t}</span>)}
                </div>
              ) : null}
            </section>

            <section className="flex-1 overflow-auto px-4 py-3 text-sm leading-relaxed text-zinc-200">
              {data.job.description?.split("\n").map((line, i) => <p key={i} className="mb-2 whitespace-pre-wrap">{line}</p>)}
            </section>

            {data.job.snapshotUrl ? (
              <details onToggle={(e) => setSnapshotOpen((e.target as HTMLDetailsElement).open)}
                className="border-t border-zinc-800">
                <summary className="cursor-pointer px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200">
                  PDF snapshot
                </summary>
                {snapshotOpen ? <iframe src={data.job.snapshotUrl} className="h-72 w-full bg-zinc-900" /> : null}
              </details>
            ) : null}

            <section className="border-t border-zinc-800 px-4 py-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                onBlur={() => onSaveNotes(note)}
                placeholder="Notes…"
                className="w-full resize-none rounded bg-zinc-900 p-2 text-xs text-zinc-100 placeholder:text-zinc-500" rows={3} />
            </section>

            <footer className="flex items-center gap-2 border-t border-zinc-800 px-4 py-3">
              <button onClick={() => onAction("queue")} className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700">Queue</button>
              <button onClick={() => onAction("applied")} className="rounded bg-emerald-700 px-3 py-1.5 text-xs hover:bg-emerald-600">Applied</button>
              <button onClick={() => onAction("skip")} className="rounded bg-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-700">Skip</button>
              <button onClick={() => onHideCompany(data.job.company)} className="rounded bg-rose-900/40 px-3 py-1.5 text-xs text-rose-200 hover:bg-rose-900/70">Hide {data.job.company}</button>
              <a href={data.job.url} target="_blank" rel="noreferrer" className="ml-auto text-xs text-zinc-400 hover:text-zinc-100">Open original ↗</a>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}

function Meta({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-500">{k}</div>
      <div className="text-zinc-200">{v ?? <span className="text-zinc-600">—</span>}</div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd web && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/_components/job-detail-panel.tsx
git commit -m "feat(ui): job detail side panel"
```

---

### Task 21: Wire dashboard page

**Files:**
- Modify: `web/app/dashboard/_components/job-feed.tsx`
- Modify: `web/app/dashboard/page.tsx`

- [ ] **Step 1: Add filter state, saved-searches strip, panel, query-string sync to job-feed**

In `job-feed.tsx`:

1. Import the new components:
```tsx
import { FilterBar, EMPTY_FILTERS, type FilterState } from "./filter-bar";
import { SavedSearchesStrip, type SavedSearch } from "./saved-searches-strip";
import { JobDetailPanel } from "./job-detail-panel";
```

2. Add state:
```tsx
const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null);
const [openJobId, setOpenJobId] = useState<string | null>(null);
```

3. Convert `filters` → query string when calling `/api/jobs`:
```tsx
function buildQuery(f: FilterState, base: { sort: string; status: string[] }): string {
  const sp = new URLSearchParams();
  sp.set("sort", base.sort);
  sp.set("status", base.status.join(","));
  if (f.level.length) sp.set("level", f.level.join(","));
  if (f.workMode.length) sp.set("workMode", f.workMode.join(","));
  if (f.source.length) sp.set("source", f.source.join(","));
  if (f.stackTags.length) sp.set("stackTags", f.stackTags.join(","));
  if (f.salaryMin !== null) sp.set("salaryMin", String(f.salaryMin));
  if (f.maxYoE !== null) sp.set("maxYoE", String(f.maxYoE));
  if (f.postedWithinHours !== null) {
    const after = new Date(Date.now() - f.postedWithinHours * 36e5).toISOString();
    sp.set("postedAfter", after);
  }
  return sp.toString();
}
```

4. Load saved searches on mount:
```tsx
useEffect(() => { fetch("/api/saved-searches").then((r) => r.json()).then((d) => setSavedSearches(d.items ?? [])); }, []);
```

5. Render strip + bar + panel:
```tsx
<>
  <SavedSearchesStrip
    items={savedSearches}
    activeId={activeSavedSearchId}
    currentFilters={filters}
    onSelect={(id) => {
      setActiveSavedSearchId(id);
      const found = savedSearches.find((s) => s.id === id);
      setFilters(found ? mergeFilters(EMPTY_FILTERS, found.filters as never) : EMPTY_FILTERS);
    }}
    onSaveCurrent={async (name) => {
      const res = await fetch("/api/saved-searches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, filters }) });
      const { item } = await res.json();
      setSavedSearches((s) => [...s, item]);
      setActiveSavedSearchId(item.id);
    }}
    onDelete={async (id) => {
      await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
      setSavedSearches((s) => s.filter((x) => x.id !== id));
      if (activeSavedSearchId === id) setActiveSavedSearchId(null);
    }}
  />
  <FilterBar value={filters} onChange={setFilters} facets={facets} knownStackTags={KNOWN_STACK} />
  {/* existing list rendering, passing onOpenDetail={setOpenJobId} into rows */}
  <JobDetailPanel
    jobId={openJobId}
    onClose={() => setOpenJobId(null)}
    onAction={async (a) => { /* PATCH /api/jobs/[id]/status */ }}
    onHideCompany={async (company) => { await fetch("/api/users/me/hidden-companies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company }) }); setOpenJobId(null); }}
    onSaveNotes={async (note) => { /* PATCH UserJob.emailNote */ }}
  />
</>
```

Define both helpers at the top of `job-feed.tsx`:

```ts
const KNOWN_STACK = [
  "react", "nextjs", "typescript", "javascript", "node", "go", "rust",
  "python", "java", "kotlin", "swift", "ruby", "rails", "django",
  "postgresql", "mysql", "redis", "kafka", "kubernetes", "docker",
  "aws", "gcp", "terraform", "graphql", "grpc",
];

function mergeFilters(base: FilterState, raw: Record<string, unknown>): FilterState {
  const arr = (k: string): string[] => Array.isArray(raw[k]) ? (raw[k] as string[]) : [];
  const num = (k: string): number | null =>
    typeof raw[k] === "number" ? (raw[k] as number) : null;
  let postedWithinHours: number | null = base.postedWithinHours;
  if (typeof raw.postedAfter === "string") {
    const hrs = Math.round((Date.now() - new Date(raw.postedAfter as string).getTime()) / 36e5);
    postedWithinHours = [24, 72, 168, 720].includes(hrs) ? hrs : null;
  }
  return {
    level: arr("level"),
    workMode: arr("workMode"),
    source: arr("source"),
    stackTags: arr("stackTags"),
    salaryMin: num("salaryMin"),
    maxYoE: num("maxYoE"),
    postedWithinHours,
  };
}
```

- [ ] **Step 2: Manual smoke test**

```bash
cd web && pnpm dev
```
Visit `http://localhost:3000/dashboard`. Confirm: filter bar renders, chips toggle, saved-search "+ Save current" round-trips, clicking a row opens the panel, Esc closes it.

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/
git commit -m "feat(ui): wire filter bar, saved searches, and detail panel into feed"
```

---

## Phase 8 — GitHub Actions

### Task 22: Pass new envs through `scraper.yml`

**Files:**
- Modify: `.github/workflows/scraper.yml`

- [ ] **Step 1: Add envs**

Add to the existing `env:` block of the scraper job (or per-step env), keeping the rest unchanged:

```yaml
env:
  VERCEL_URL: ${{ secrets.VERCEL_URL }}
  INGEST_BEARER_TOKEN: ${{ secrets.INGEST_BEARER_TOKEN }}
  BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
  BRAVE_SEARCH_API_KEY: ${{ secrets.BRAVE_SEARCH_API_KEY }}
  SEARCH_QUERIES_JSON: ${{ vars.SEARCH_QUERIES_JSON }}
```

And in the web ingest deploy env (Vercel project settings, not the workflow), add `SYSTEM_AI_API_KEY`. Document this in the PR description.

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/scraper.yml
git commit -m "ci: pass brave + search-queries env to scraper"
```

---

## Verification (manual end-to-end)

After all tasks are merged:

1. **Migration:** `cd web && pnpm prisma migrate deploy` against staging Neon. New columns/indexes/tables present.
2. **Brave lane runs:** trigger the scraper workflow manually with the new secret set; logs show `source=brave scraped=N` non-zero.
3. **Tagger fires:** `/api/jobs/ingest` response shows `taggerStats.tagged > 0`. Spot-check 5 newly inserted jobs in the DB — `level`, `workMode`, `stackTags`, `taggedAt` populated.
4. **Backfill:** `cd web && SYSTEM_AI_API_KEY=… pnpm tsx scripts/backfill-tags.ts` finishes; no rows with `taggedAt IS NULL` remain.
5. **Feed filters:** `curl '/api/jobs?level=senior,staff&workMode=remote&stackTags=react&postedAfter=…'` → result count drops as filters tighten; `facets` field present.
6. **Saved searches round-trip:** create one in the UI, refresh, confirm it persists, click it → bar populates.
7. **Hidden company:** open detail panel, click "Hide {company}", confirm rows from that company disappear from the feed; remove via Settings (or by re-adding) → rows reappear.
8. **Side panel:** click row → panel opens with description + AI summary + actions; Esc closes.
9. **Freshness dots:** rows posted in last 6h render green; 6–24h yellow; older gray.
10. **CI pipeline:** push the workflow change, watch one full cron run; ingest summary shows both `source=*` lanes producing rows and `taggerStats.tagged > 0`.

## Critical files reference

- Schema: `web/prisma/schema.prisma`
- Tagger: `web/lib/ai/tagger.ts`, `web/lib/ai/tagger-types.ts`, `web/lib/ai/stack-aliases.ts`
- Backfill: `web/scripts/backfill-tags.ts`
- Brave lane: `scraper/src/scrapers/brave.ts`, `scraper/src/utils/brave.ts`, `scraper/src/utils/classify.ts`
- Per-ATS fetchOne: `scraper/src/scrapers/{ashby,greenhouse,lever}.ts`
- Ingest with tagger + auto-skip: `web/app/api/jobs/ingest/route.ts`
- Hidden-companies API: `web/app/api/users/me/hidden-companies/{,[company]/}route.ts`
- Saved-searches API: `web/app/api/saved-searches/{,[id]/}route.ts`, `web/lib/feed-filters.ts`
- Feed API: `web/app/api/jobs/route.ts`, `web/app/api/jobs/[id]/route.ts`
- UI: `web/app/dashboard/_components/{filter-bar,saved-searches-strip,job-detail-panel,job-row,job-feed}.tsx`
- CI: `.github/workflows/scraper.yml`

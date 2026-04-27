import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    job: { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
    userJob: { createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/ai/tagger", () => ({
  tagJob: vi.fn().mockResolvedValue({
    level: "senior", workMode: "remote",
    locationCity: "New York", locationCountry: "US",
    salaryMin: 180000, salaryMax: 240000, minYoE: 5,
    stackTags: ["react", "typescript"],
  }),
}));

const mockScoreJob = vi.fn();
vi.mock("@/lib/ai/provider", () => ({
  getProvider: vi.fn(() => ({ scoreJob: mockScoreJob })),
}));

import { POST } from "./route";
import { tagAndUpdateNewJobs } from "./tagger-pass";
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
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/jobs/ingest", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.INGEST_BEARER_TOKEN = VALID_TOKEN;
  delete process.env.SYSTEM_AI_API_KEY; // ensure tagger is skipped in POST tests
  (prisma.job.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.job.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1", url: VALID_JOB.url });
  (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.userJob.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 0 });
  (prisma.userJob.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  (prisma.userJob.update as ReturnType<typeof vi.fn>).mockResolvedValue({});
  mockScoreJob.mockResolvedValue({ score: 80, reason: "Great match" });
});

describe("POST /api/jobs/ingest — auth", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(makeRequest({ jobs: [VALID_JOB] }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when bearer token is wrong", async () => {
    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, "wrong-token"));
    expect(res.status).toBe(401);
  });

  it("returns 500 when INGEST_BEARER_TOKEN env var is not set", async () => {
    delete process.env.INGEST_BEARER_TOKEN;
    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    expect(res.status).toBe(500);
    process.env.INGEST_BEARER_TOKEN = VALID_TOKEN;
  });

  it("passes auth with correct bearer token", async () => {
    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    expect(res.status).not.toBe(401);
  });
});

describe("POST /api/jobs/ingest — body validation", () => {
  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makeRequest("not json {{{", VALID_TOKEN));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/JSON/i);
  });

  it("returns 400 when jobs array is missing", async () => {
    const res = await POST(makeRequest({}, VALID_TOKEN));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues).toBeDefined();
  });

  it("returns 400 when jobs array exceeds 200", async () => {
    const jobs = Array.from({ length: 201 }, (_, i) => ({
      ...VALID_JOB,
      url: `https://jobs.ashby.io/acme/job-${i}`,
    }));
    const res = await POST(makeRequest({ jobs }, VALID_TOKEN));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a job has an invalid URL", async () => {
    const res = await POST(makeRequest({ jobs: [{ ...VALID_JOB, url: "not-a-url" }] }, VALID_TOKEN));
    expect(res.status).toBe(400);
  });

  it("returns 400 when source is not a valid enum value", async () => {
    const res = await POST(makeRequest({ jobs: [{ ...VALID_JOB, source: "unknown-ats" }] }, VALID_TOKEN));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/jobs/ingest — deduplication", () => {
  it("reports jobsNew correctly when all jobs are new", async () => {
    (prisma.job.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (prisma.job.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1", url: VALID_JOB.url });

    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jobsReceived).toBe(1);
    expect(body.jobsNew).toBe(1);
    expect(body.jobsExisting).toBe(0);
  });

  it("reports jobsExisting correctly when job already exists", async () => {
    (prisma.job.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ url: VALID_JOB.url }]);
    (prisma.job.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1", url: VALID_JOB.url });

    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    const body = await res.json();
    expect(body.jobsNew).toBe(0);
    expect(body.jobsExisting).toBe(1);
  });
});

describe("POST /api/jobs/ingest — scoring", () => {
  it("creates and scores UserJob rows for eligible users", async () => {
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "user-1", aiProvider: null, aiApiKey: null, skillsProfile: "TypeScript,React" },
    ]);
    (prisma.userJob.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.userJob.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "uj-1", jobId: "job-1" }]);

    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userJobsCreated).toBe(1);
    expect(body.userJobsScored).toBe(1);
    expect(body.errors).toHaveLength(0);
    expect(mockScoreJob).toHaveBeenCalledOnce();
  });

  it("skips when no users have skillsProfile", async () => {
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    const body = await res.json();
    expect(body.userJobsCreated).toBe(0);
    expect(body.userJobsScored).toBe(0);
    expect(mockScoreJob).not.toHaveBeenCalled();
  });

  it("records provider errors but still returns HTTP 200", async () => {
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "user-1", aiProvider: null, aiApiKey: null, skillsProfile: "TypeScript" },
    ]);
    (prisma.userJob.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 });
    (prisma.userJob.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "uj-1", jobId: "job-1" }]);
    mockScoreJob.mockRejectedValue(new Error("Groq API error: rate limit exceeded"));

    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userJobsScored).toBe(0);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].error).toMatch(/rate limit/);
  });

  it("does not score when batch contains only existing jobs (idempotency)", async () => {
    (prisma.job.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ url: VALID_JOB.url }]);
    (prisma.job.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1", url: VALID_JOB.url });
    (prisma.user.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "user-1", aiProvider: null, aiApiKey: null, skillsProfile: "TypeScript" },
    ]);

    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    const body = await res.json();
    expect(body.jobsNew).toBe(0);
    expect(body.userJobsCreated).toBe(0);
    expect(body.userJobsScored).toBe(0);
    expect(mockScoreJob).not.toHaveBeenCalled();
  });
});

describe("POST /api/jobs/ingest — response shape", () => {
  it("response contains all required fields", async () => {
    const res = await POST(makeRequest({ jobs: [VALID_JOB] }, VALID_TOKEN));
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      jobsReceived: expect.any(Number),
      jobsNew: expect.any(Number),
      jobsExisting: expect.any(Number),
      userJobsCreated: expect.any(Number),
      userJobsScored: expect.any(Number),
      errors: expect.any(Array),
    });
  });
});

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

import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, findMany, count, groupBy } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique }, userJob: { findMany, count, groupBy } },
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
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest(url));
    expect(res.status).toBe(200);
    const where = findMany.mock.calls[0][0].where as Record<string, unknown>;
    const job = where.job as Record<string, unknown>;
    expect(job.level).toEqual({ in: ["senior", "staff"] });
    expect(job.workMode).toEqual({ in: ["remote"] });
    expect(job.stackTags).toEqual({ hasSome: ["react", "go"] });
    expect(job.postedAt).toEqual(expect.objectContaining({ gte: expect.any(Date) }));
  });

  it("returns facets in response", async () => {
    findMany.mockResolvedValue([
      { job: { level: "senior", workMode: "remote", source: "ashby", stackTags: ["react"] } },
      { job: { level: "senior", workMode: "remote", source: "ashby", stackTags: ["go"] } },
    ]);
    const { NextRequest } = await import("next/server");
    const res = await GET(new NextRequest("http://x/api/jobs"));
    const body = await res.json();
    expect(body.facets).toBeDefined();
    expect(body.facets.level.senior).toBe(2);
  });
});

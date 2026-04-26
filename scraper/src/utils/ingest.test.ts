import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestJobs } from "./ingest.js";
import type { JobRecord } from "../types.js";

function makeJob(i: number): JobRecord {
  return {
    url: `https://example.com/job/${i}`,
    title: "Software Engineer",
    company: "Acme",
    location: "Remote",
    description: null,
    source: "ashby",
    postedAt: new Date().toISOString(),
    snapshotUrl: null,
  };
}

const MOCK_URL = "http://localhost:3000";
const MOCK_TOKEN = "test-token";

beforeEach(() => {
  process.env.VERCEL_URL = MOCK_URL;
  process.env.INGEST_BEARER_TOKEN = MOCK_TOKEN;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jobsReceived: 5 }),
      text: async () => "",
    }),
  );
});

describe("ingestJobs", () => {
  it("returns {sent:0,errors:0} for empty array", async () => {
    const result = await ingestJobs([]);
    expect(result).toEqual({ sent: 0, errors: 0 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts one batch for 5 jobs", async () => {
    const result = await ingestJobs(Array.from({ length: 5 }, (_, i) => makeJob(i)));
    expect(result).toEqual({ sent: 5, errors: 0 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("posts two batches for 250 jobs (200+50)", async () => {
    const result = await ingestJobs(Array.from({ length: 250 }, (_, i) => makeJob(i)));
    expect(result.sent).toBe(250);
    expect(result.errors).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("counts errors on non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      }),
    );
    const result = await ingestJobs([makeJob(1)]);
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("counts errors on network error (fetch throws)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const result = await ingestJobs([makeJob(1)]);
    expect(result.errors).toBe(1);
    expect(result.sent).toBe(0);
  });

  it("sends correct Authorization header", async () => {
    await ingestJobs([makeJob(1)]);
    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Bearer ${MOCK_TOKEN}`);
  });
});

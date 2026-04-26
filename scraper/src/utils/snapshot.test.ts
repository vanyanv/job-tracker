import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JobRecord } from "../types.js";

const mockPage = {
  goto: vi.fn().mockResolvedValue(null),
  waitForLoadState: vi.fn().mockResolvedValue(null),
  pdf: vi.fn().mockResolvedValue(Buffer.from("fake-pdf")),
};
const mockContext = {
  newPage: vi.fn().mockResolvedValue(mockPage),
  close: vi.fn().mockResolvedValue(null),
};
const mockBrowser = {
  newContext: vi.fn().mockResolvedValue(mockContext),
  close: vi.fn().mockResolvedValue(null),
};

vi.mock("playwright", () => ({
  chromium: { launch: vi.fn().mockResolvedValue(mockBrowser) },
}));

const mockPut = vi.fn().mockResolvedValue({
  url: "https://abc.public.blob.vercel-storage.com/snapshots/ashby/aabbccdd11223344.pdf",
});
vi.mock("@vercel/blob", () => ({ put: mockPut }));

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    url: "https://jobs.ashbyhq.com/linear/some-job",
    title: "Software Engineer",
    company: "Linear",
    location: "Remote, US",
    description: null,
    source: "ashby",
    postedAt: new Date().toISOString(),
    snapshotUrl: null,
    ...overrides,
  };
}

describe("snapshotJobs", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, BLOB_READ_WRITE_TOKEN: "test-token" };
    vi.clearAllMocks();
    mockPut.mockResolvedValue({
      url: "https://abc.public.blob.vercel-storage.com/snapshots/ashby/aabbccdd11223344.pdf",
    });
    mockPage.goto.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it("returns empty array without launching browser", async () => {
    const { snapshotJobs } = await import("./snapshot.js");
    const { chromium } = await import("playwright");
    const result = await snapshotJobs([]);
    expect(result).toEqual([]);
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("skips snapshot pass when BLOB_READ_WRITE_TOKEN is absent", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const { snapshotJobs } = await import("./snapshot.js");
    const { chromium } = await import("playwright");
    const jobs = [makeJob()];
    const result = await snapshotJobs(jobs);
    expect(result[0].snapshotUrl).toBeNull();
    expect(chromium.launch).not.toHaveBeenCalled();
  });

  it("sets snapshotUrl on success", async () => {
    const { snapshotJobs } = await import("./snapshot.js");
    const jobs = [makeJob()];
    await snapshotJobs(jobs);
    expect(jobs[0].snapshotUrl).toBe(
      "https://abc.public.blob.vercel-storage.com/snapshots/ashby/aabbccdd11223344.pdf",
    );
  });

  it("leaves snapshotUrl null when page.goto throws", async () => {
    mockPage.goto.mockRejectedValueOnce(new Error("navigation timeout"));
    const { snapshotJobs } = await import("./snapshot.js");
    const jobs = [makeJob()];
    await snapshotJobs(jobs);
    expect(jobs[0].snapshotUrl).toBeNull();
  });

  it("leaves snapshotUrl null when put() throws", async () => {
    mockPut.mockRejectedValueOnce(new Error("upload failed"));
    const { snapshotJobs } = await import("./snapshot.js");
    const jobs = [makeJob()];
    await snapshotJobs(jobs);
    expect(jobs[0].snapshotUrl).toBeNull();
  });

  it("always closes the browser even when a job fails", async () => {
    mockPage.goto.mockRejectedValueOnce(new Error("timeout"));
    const { snapshotJobs } = await import("./snapshot.js");
    await snapshotJobs([makeJob()]);
    expect(mockBrowser.close).toHaveBeenCalledOnce();
  });

  it("calls put() with correct pathname pattern + options", async () => {
    const { snapshotJobs } = await import("./snapshot.js");
    const job = makeJob({ source: "ashby", url: "https://jobs.ashbyhq.com/linear/some-job" });
    await snapshotJobs([job]);
    expect(mockPut).toHaveBeenCalledWith(
      expect.stringMatching(/^snapshots\/ashby\/[0-9a-f]{16}\.pdf$/),
      expect.any(Buffer),
      expect.objectContaining({
        access: "public",
        contentType: "application/pdf",
        allowOverwrite: true,
      }),
    );
  });

  describe.skipIf(!process.env.SCRAPER_SNAPSHOT_LIVE_TEST)(
    "live snapshot test (SCRAPER_SNAPSHOT_LIVE_TEST=1)",
    () => {
      it("snapshots a real URL and returns a reachable Blob URL", async () => {
        const { snapshotJobs } = await import("./snapshot.js");
        const job = makeJob({
          url: "https://jobs.ashbyhq.com/linear",
          source: "ashby",
        });
        await snapshotJobs([job]);
        expect(job.snapshotUrl).toMatch(
          /^https:\/\/.+\.public\.blob\.vercel-storage\.com\/snapshots\/ashby\/.+\.pdf$/,
        );
        const headRes = await fetch(job.snapshotUrl!, { method: "HEAD" });
        expect(headRes.status).toBe(200);
      }, 60_000);
    },
  );
});

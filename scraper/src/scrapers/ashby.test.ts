import { describe, it, expect } from "vitest";
import { scrapeAshby } from "./ashby.js";

describe.skipIf(!process.env.SCRAPER_LIVE_TEST)("scrapeAshby — live", () => {
  it("fetches jobs from at least one Ashby org", async () => {
    const jobs = await scrapeAshby();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].url).toMatch(/^https:\/\//);
    expect(jobs[0].source).toBe("ashby");
    expect(jobs[0].postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, 30_000);
});

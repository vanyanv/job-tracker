import { describe, it, expect } from "vitest";
import { scrapeGreenhouse } from "./greenhouse.js";

describe.skipIf(!process.env.SCRAPER_LIVE_TEST)("scrapeGreenhouse — live", () => {
  it("fetches jobs from at least one Greenhouse org", async () => {
    const jobs = await scrapeGreenhouse();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].url).toMatch(/^https:\/\//);
    expect(jobs[0].source).toBe("greenhouse");
    expect(jobs[0].postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, 30_000);
});

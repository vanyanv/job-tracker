import { describe, it, expect } from "vitest";
import { scrapeLever } from "./lever.js";

describe.skipIf(!process.env.SCRAPER_LIVE_TEST)("scrapeLever — live", () => {
  it("fetches jobs from at least one Lever org", async () => {
    const jobs = await scrapeLever();
    expect(jobs.length).toBeGreaterThan(0);
    expect(jobs[0].url).toMatch(/^https:\/\//);
    expect(jobs[0].source).toBe("lever");
    expect(jobs[0].postedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  }, 30_000);
});

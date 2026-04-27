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
    title: "FE Eng",
    company: "Notion",
    location: "Remote",
    description: "desc",
    source: "ashby",
    postedAt: new Date().toISOString(),
    snapshotUrl: null,
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

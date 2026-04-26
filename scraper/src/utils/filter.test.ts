import { describe, it, expect } from "vitest";
import { filterJobs } from "./filter.js";
import type { JobRecord } from "../types.js";

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    url: "https://example.com/job/1",
    title: "Software Engineer",
    company: "Acme",
    location: "Remote",
    description: null,
    source: "ashby",
    postedAt: new Date().toISOString(),
    snapshotUrl: null,
    ...overrides,
  };
}

const OPTS = { hoursWindow: 24 };

describe("filterJobs — age", () => {
  it("passes job posted 12h ago", () => {
    const job = makeJob({ postedAt: new Date(Date.now() - 12 * 3_600_000).toISOString() });
    expect(filterJobs([job], OPTS)).toHaveLength(1);
  });
  it("rejects job posted 25h ago", () => {
    const job = makeJob({ postedAt: new Date(Date.now() - 25 * 3_600_000).toISOString() });
    expect(filterJobs([job], OPTS)).toHaveLength(0);
  });
  it("passes job posted 30h ago with 48h window", () => {
    const job = makeJob({ postedAt: new Date(Date.now() - 30 * 3_600_000).toISOString() });
    expect(filterJobs([job], { hoursWindow: 48 })).toHaveLength(1);
  });
  it("rejects job with unparseable postedAt", () => {
    const job = makeJob({ postedAt: "not-a-date" });
    expect(filterJobs([job], OPTS)).toHaveLength(0);
  });
});

describe("filterJobs — location", () => {
  it('passes "Remote"', () => {
    expect(filterJobs([makeJob({ location: "Remote" })], OPTS)).toHaveLength(1);
  });
  it('passes "New York, NY"', () => {
    expect(filterJobs([makeJob({ location: "New York, NY" })], OPTS)).toHaveLength(1);
  });
  it('passes "Remote, US"', () => {
    expect(filterJobs([makeJob({ location: "Remote, US" })], OPTS)).toHaveLength(1);
  });
  it('passes "San Francisco"', () => {
    expect(filterJobs([makeJob({ location: "San Francisco, CA" })], OPTS)).toHaveLength(1);
  });
  it('rejects "London, UK"', () => {
    expect(filterJobs([makeJob({ location: "London, UK" })], OPTS)).toHaveLength(0);
  });
  it("rejects empty string", () => {
    expect(filterJobs([makeJob({ location: "" })], OPTS)).toHaveLength(0);
  });
});

describe("filterJobs — title", () => {
  it('passes "Senior Software Engineer"', () => {
    expect(filterJobs([makeJob({ title: "Senior Software Engineer" })], OPTS)).toHaveLength(1);
  });
  it('passes "Backend Engineer"', () => {
    expect(filterJobs([makeJob({ title: "Backend Engineer" })], OPTS)).toHaveLength(1);
  });
  it('passes "Full-Stack Engineer"', () => {
    expect(filterJobs([makeJob({ title: "Full-Stack Engineer" })], OPTS)).toHaveLength(1);
  });
  it('passes "Fullstack Engineer"', () => {
    expect(filterJobs([makeJob({ title: "Fullstack Engineer" })], OPTS)).toHaveLength(1);
  });
  it('passes "Data Engineer"', () => {
    expect(filterJobs([makeJob({ title: "Data Engineer" })], OPTS)).toHaveLength(1);
  });
  it('rejects "Data Analyst"', () => {
    expect(filterJobs([makeJob({ title: "Data Analyst" })], OPTS)).toHaveLength(0);
  });
  it('rejects "Account Executive"', () => {
    expect(filterJobs([makeJob({ title: "Account Executive" })], OPTS)).toHaveLength(0);
  });
});

describe("filterJobs — combined", () => {
  it("requires all three filters to pass", () => {
    const oldJob = makeJob({ postedAt: new Date(Date.now() - 30 * 3_600_000).toISOString() });
    const nonUS = makeJob({ location: "London" });
    const nonSWE = makeJob({ title: "Account Executive" });
    const good = makeJob();
    expect(filterJobs([oldJob, nonUS, nonSWE, good], OPTS)).toHaveLength(1);
  });
});

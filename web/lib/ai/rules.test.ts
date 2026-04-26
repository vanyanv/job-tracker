import { describe, it, expect } from "vitest";
import { RulesProvider } from "./rules";
import { ResumeProfileSchema } from "./provider";
import type { JobInput, ResumeProfile } from "./provider";

const MATCH_JOB: JobInput = {
  title: "Senior TypeScript Engineer",
  company: "Acme",
  location: "Remote, US",
  description: "TypeScript, React, and Node.js expertise required. Next.js and PostgreSQL a plus.",
};
const NO_MATCH_JOB: JobInput = {
  title: "Java Spring Boot Developer",
  company: "Enterprise Corp",
  location: "On-site, NY",
  description: "10+ years Java Spring Boot. Oracle Database and Maven required.",
};
const PROFILE: ResumeProfile = {
  skills: ["TypeScript", "React", "Node.js", "Next.js", "PostgreSQL"],
  titles: ["Senior Software Engineer"],
  yearsExperience: 6,
  summary: "Full-stack engineer with 6 years building TypeScript applications.",
};
const SAMPLE_RESUME = `
Senior Software Engineer at Acme Corp (2020–2026)
TypeScript, React, Node.js, Next.js, PostgreSQL, Docker

5 years of professional experience building full-stack web applications.
Led migration from JavaScript to TypeScript across 50k-LOC codebase.
`.trim();

const p = new RulesProvider();

describe("RulesProvider.scoreJob", () => {
  it("match job scores > 50", async () => {
    const r = await p.scoreJob(MATCH_JOB, PROFILE);
    expect(r.score).toBeGreaterThan(50);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it("no-match job scores 0", async () => {
    const r = await p.scoreJob(NO_MATCH_JOB, PROFILE);
    expect(r.score).toBe(0);
  });

  it("match job scores strictly higher than no-match", async () => {
    const [a, b] = await Promise.all([
      p.scoreJob(MATCH_JOB, PROFILE),
      p.scoreJob(NO_MATCH_JOB, PROFILE),
    ]);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("empty skills profile returns score 0", async () => {
    const r = await p.scoreJob(MATCH_JOB, { ...PROFILE, skills: [] });
    expect(r.score).toBe(0);
    expect(r.reason).toContain("No skills");
  });

  it("score is always integer in [0, 100]", async () => {
    const r = await p.scoreJob(MATCH_JOB, PROFILE);
    expect(Number.isInteger(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("RulesProvider.parseResume", () => {
  it("finds known skills in resume text", async () => {
    const r = await p.parseResume(SAMPLE_RESUME);
    expect(r.skills).toContain("TypeScript");
    expect(r.skills).toContain("React");
    expect(r.skills).toContain("Node.js");
  });

  it("extracts years of experience", async () => {
    const r = await p.parseResume(SAMPLE_RESUME);
    expect(r.yearsExperience).toBe(5);
  });

  it("returns non-empty summary", async () => {
    const r = await p.parseResume(SAMPLE_RESUME);
    expect(r.summary.length).toBeGreaterThan(10);
  });

  it("output passes ResumeProfileSchema.parse()", async () => {
    const r = await p.parseResume(SAMPLE_RESUME);
    expect(() => ResumeProfileSchema.parse(r)).not.toThrow();
  });

  it("handles near-empty text without throwing", async () => {
    const r = await p.parseResume("John Doe — developer");
    expect(r.skills).toBeInstanceOf(Array);
    expect(r.yearsExperience).toBe(0);
  });
});

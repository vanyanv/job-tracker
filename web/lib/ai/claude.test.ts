import { describe, it, expect } from "vitest";
import type { JobInput, ResumeProfile } from "./provider";

const MATCH_JOB: JobInput = {
  title: "Senior TypeScript Engineer", company: "Startup",
  location: "Remote", description: "TypeScript, React, Node.js required.",
};
const NO_MATCH_JOB: JobInput = {
  title: "Java Developer", company: "Corp",
  location: "On-site", description: "10+ years Java Spring Boot.",
};
const PROFILE: ResumeProfile = {
  skills: ["TypeScript", "React", "Node.js"],
  titles: ["Software Engineer"], yearsExperience: 5,
  summary: "Full-stack TypeScript engineer.",
};
const RESUME = "Senior TypeScript Engineer. TypeScript, React, Node.js. 5 years of professional experience.";

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("ClaudeProvider (requires ANTHROPIC_API_KEY)", () => {
  it("scoreJob returns valid ScoreResult", async () => {
    const { ClaudeProvider } = await import("./claude");
    const { ScoreResultSchema } = await import("./provider");
    const p = new ClaudeProvider(process.env.ANTHROPIC_API_KEY!);
    const r = await p.scoreJob(MATCH_JOB, PROFILE);
    expect(() => ScoreResultSchema.parse(r)).not.toThrow();
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it("match job scores higher than no-match", async () => {
    const { ClaudeProvider } = await import("./claude");
    const p = new ClaudeProvider(process.env.ANTHROPIC_API_KEY!);
    const [a, b] = await Promise.all([
      p.scoreJob(MATCH_JOB, PROFILE),
      p.scoreJob(NO_MATCH_JOB, PROFILE),
    ]);
    expect(a.score).toBeGreaterThan(b.score);
  });

  it("parseResume returns valid ResumeProfile with skills", async () => {
    const { ClaudeProvider } = await import("./claude");
    const { ResumeProfileSchema } = await import("./provider");
    const p = new ClaudeProvider(process.env.ANTHROPIC_API_KEY!);
    const r = await p.parseResume(RESUME);
    expect(() => ResumeProfileSchema.parse(r)).not.toThrow();
    expect(r.skills.length).toBeGreaterThan(0);
  });
});

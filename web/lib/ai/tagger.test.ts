import { describe, it, expect, vi, beforeEach } from "vitest";

const createMock = vi.fn();
vi.mock("groq-sdk", () => ({
  default: class { chat = { completions: { create: createMock } }; },
}));

import { tagJob } from "./tagger";

beforeEach(() => createMock.mockReset());

describe("tagJob", () => {
  it("parses a valid Groq response into JobTags", async () => {
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({
        level: "senior",
        workMode: "remote",
        locationCity: "New York",
        locationCountry: "US",
        salaryMin: 180000, salaryMax: 240000,
        minYoE: 5,
        stackTags: ["React.js", "TypeScript", "Postgres"],
      }) } }],
    });
    const tags = await tagJob(
      { title: "Senior FE Engineer", company: "Acme", locationRaw: "NYC / Remote", description: "..." },
      { apiKey: "k", model: "llama-3.3-70b-versatile" },
    );
    expect(tags.level).toBe("senior");
    expect(tags.workMode).toBe("remote");
    expect(tags.stackTags).toEqual(["react", "typescript", "postgresql"]);
    expect(tags.salaryMin).toBe(180000);
  });

  it("falls back to unknown on malformed JSON", async () => {
    createMock.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    const tags = await tagJob(
      { title: "x", company: "y", locationRaw: "", description: null },
      { apiKey: "k", model: "llama-3.3-70b-versatile" },
    );
    expect(tags.level).toBe("unknown");
    expect(tags.workMode).toBe("unknown");
    expect(tags.stackTags).toEqual([]);
  });
});

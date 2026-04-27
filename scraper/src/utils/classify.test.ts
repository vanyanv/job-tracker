import { describe, it, expect } from "vitest";
import { classifyUrl } from "./classify.js";

describe("classifyUrl", () => {
  it("recognizes ashby URLs", () => {
    expect(classifyUrl("https://jobs.ashbyhq.com/notion/abc-123")).toEqual({ ats: "ashby", org: "notion", jobId: "abc-123" });
  });
  it("recognizes greenhouse URLs", () => {
    expect(classifyUrl("https://boards.greenhouse.io/airbnb/jobs/12345")).toEqual({ ats: "greenhouse", org: "airbnb", jobId: "12345" });
  });
  it("recognizes lever URLs", () => {
    expect(classifyUrl("https://jobs.lever.co/figma/some-uuid-here")).toEqual({ ats: "lever", org: "figma", jobId: "some-uuid-here" });
  });
  it("returns null for unknown hosts", () => {
    expect(classifyUrl("https://example.com/jobs/1")).toBeNull();
  });
  it("returns null for malformed URLs", () => {
    expect(classifyUrl("not-a-url")).toBeNull();
  });
});

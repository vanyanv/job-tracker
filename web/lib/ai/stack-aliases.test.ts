import { describe, it, expect } from "vitest";
import { normalizeStackTag, normalizeStackTags } from "./stack-aliases";

describe("normalizeStackTag", () => {
  it("lowercases and aliases known variants", () => {
    expect(normalizeStackTag("React.js")).toBe("react");
    expect(normalizeStackTag("NodeJS")).toBe("node");
    expect(normalizeStackTag("Golang")).toBe("go");
    expect(normalizeStackTag("Postgres")).toBe("postgresql");
    expect(normalizeStackTag("k8s")).toBe("kubernetes");
  });
  it("passes unknown tags through lowercased + trimmed", () => {
    expect(normalizeStackTag(" Rust ")).toBe("rust");
  });
  it("returns null for empty / junk", () => {
    expect(normalizeStackTag("")).toBeNull();
    expect(normalizeStackTag("   ")).toBeNull();
  });
});

describe("normalizeStackTags", () => {
  it("dedupes and caps to 8", () => {
    const out = normalizeStackTags(["React", "react.js", "Node", "Go", "Go", "Rust", "Python", "TS", "JS", "K8s", "Docker"]);
    expect(out.length).toBeLessThanOrEqual(8);
    expect(new Set(out).size).toBe(out.length);
  });
});

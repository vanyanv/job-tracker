import { describe, it, expect } from "vitest";
import { normalizeCompany } from "./companies";

describe("normalizeCompany", () => {
  it("lowercases, trims, strips suffixes", () => {
    expect(normalizeCompany("Stripe, Inc.")).toBe("stripe");
    expect(normalizeCompany("  Acme LLC  ")).toBe("acme");
    expect(normalizeCompany("Foo Corp")).toBe("foo");
    expect(normalizeCompany("Bar Inc")).toBe("bar");
    expect(normalizeCompany("Baz")).toBe("baz");
  });
  it("handles compound suffixes", () => {
    expect(normalizeCompany("Foo, Inc., LLC")).toBe("foo");
  });
  it("returns empty for empty input", () => {
    expect(normalizeCompany("")).toBe("");
    expect(normalizeCompany("   ")).toBe("");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { braveSearch } from "./brave.js";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("braveSearch", () => {
  it("sends the right query and parses results", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        web: {
          results: [
            { url: "https://jobs.ashbyhq.com/foo/1", title: "FE Eng", description: "..." },
          ],
        },
      }),
    });
    const out = await braveSearch({ q: "frontend engineer", apiKey: "k", count: 20 });
    expect(out.length).toBe(1);
    expect(out[0].url).toContain("ashbyhq.com");
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("q=frontend+engineer");
    expect(calledUrl).toContain("count=20");
  });

  it("returns [] on non-2xx", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, text: async () => "rate" });
    expect(await braveSearch({ q: "x", apiKey: "k" })).toEqual([]);
  });

  it("returns [] when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    expect(await braveSearch({ q: "x", apiKey: "k" })).toEqual([]);
  });

  it("includes freshness and country params when provided", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ web: { results: [] } }),
    });
    await braveSearch({ q: "x", apiKey: "k", freshness: "pd", country: "us" });
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("freshness=pd");
    expect(calledUrl).toContain("country=us");
  });
});

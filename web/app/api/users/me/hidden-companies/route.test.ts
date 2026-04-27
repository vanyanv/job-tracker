import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUnique, update, updateMany, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique, update }, userJob: { updateMany }, job: { findMany } },
}));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "u@e.com" } }) }));

import { GET, POST } from "./route";
import { DELETE } from "./[company]/route";

beforeEach(() => { findUnique.mockReset(); update.mockReset(); updateMany.mockReset(); findMany.mockReset(); });

function mkReq(url: string, init?: RequestInit) { return new Request(url, init); }

describe("hidden-companies route", () => {
  it("GET returns current list", async () => {
    findUnique.mockResolvedValue({ id: "u1", hiddenCompanies: ["acme", "stripe"] });
    const res = await GET();
    expect(await res.json()).toEqual({ companies: ["acme", "stripe"] });
  });

  it("POST adds + retroactively skips", async () => {
    findUnique.mockResolvedValue({ id: "u1", hiddenCompanies: [] });
    findMany.mockResolvedValue([{ id: "j1", company: "Acme, Inc." }, { id: "j2", company: "Other" }]);
    update.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(mkReq("http://x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: "Acme, Inc." }),
    }));
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { hiddenCompanies: ["acme"] },
    }));
    expect(updateMany).toHaveBeenCalled();
  });

  it("DELETE removes + un-skips auto-skipped", async () => {
    findUnique.mockResolvedValue({ id: "u1", hiddenCompanies: ["acme", "stripe"] });
    findMany.mockResolvedValue([{ id: "j1", company: "Acme, Inc." }]);
    update.mockResolvedValue({});
    updateMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(mkReq("http://x"), { params: Promise.resolve({ company: "acme" }) });
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: { hiddenCompanies: ["stripe"] },
    }));
  });
});

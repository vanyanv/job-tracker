import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueU, findMany, create, update, del, findUniqueSS } = vi.hoisted(() => ({
  findUniqueU: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  findUniqueSS: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueU },
    savedSearch: { findMany, create, update, delete: del, findUnique: findUniqueSS },
  },
}));
vi.mock("@/auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { email: "u@e.com" } }),
}));

import { GET, POST } from "./route";
import { PATCH, DELETE } from "./[id]/route";

beforeEach(() => {
  findUniqueU.mockResolvedValue({ id: "u1" });
  findMany.mockReset();
  create.mockReset();
  update.mockReset();
  del.mockReset();
  findUniqueSS.mockReset();
});

describe("saved-searches", () => {
  it("GET returns user's saved searches", async () => {
    findMany.mockResolvedValue([{ id: "s1", name: "FE Remote", filters: {}, sortIndex: 0 }]);
    const res = await GET();
    expect((await res.json()).items).toHaveLength(1);
  });

  it("POST rejects invalid filters", async () => {
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ name: "x", filters: { unknownField: 1 } }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("POST creates with valid filters", async () => {
    create.mockResolvedValue({ id: "s2", name: "BE", filters: { level: ["staff"] }, sortIndex: 0 });
    const res = await POST(
      new Request("http://x", {
        method: "POST",
        body: JSON.stringify({ name: "BE", filters: { level: ["staff"] } }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("PATCH updates when row belongs to user", async () => {
    findUniqueSS.mockResolvedValue({ id: "s1", userId: "u1" });
    update.mockResolvedValue({});
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "x" }) }),
      { params: Promise.resolve({ id: "s1" }) },
    );
    expect(res.status).toBe(200);
  });

  it("PATCH returns 404 when row belongs to another user", async () => {
    findUniqueSS.mockResolvedValue({ id: "s1", userId: "other" });
    const res = await PATCH(
      new Request("http://x", { method: "PATCH", body: JSON.stringify({ name: "x" }) }),
      { params: Promise.resolve({ id: "s1" }) },
    );
    expect(res.status).toBe(404);
  });

  it("DELETE removes when row belongs to user", async () => {
    findUniqueSS.mockResolvedValue({ id: "s1", userId: "u1" });
    del.mockResolvedValue({});
    const res = await DELETE(new Request("http://x"), { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(200);
  });
});

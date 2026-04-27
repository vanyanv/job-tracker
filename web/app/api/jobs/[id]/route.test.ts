import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueU, findUniqueJ, findUniqueUJ } = vi.hoisted(() => ({
  findUniqueU: vi.fn(),
  findUniqueJ: vi.fn(),
  findUniqueUJ: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: findUniqueU },
    job: { findUnique: findUniqueJ },
    userJob: { findUnique: findUniqueUJ },
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue({ user: { email: "u@e.com" } }) }));

import { GET } from "./route";

beforeEach(() => {
  findUniqueU.mockResolvedValue({ id: "u1" });
  findUniqueJ.mockReset();
  findUniqueUJ.mockReset();
});

describe("/api/jobs/[id]", () => {
  it("returns 404 for missing job", async () => {
    findUniqueJ.mockResolvedValue(null);
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "j-x" }) });
    expect(res.status).toBe(404);
  });

  it("returns job + userJob", async () => {
    findUniqueJ.mockResolvedValue({ id: "j1", title: "FE", company: "Acme", url: "https://j", stackTags: ["react"] });
    findUniqueUJ.mockResolvedValue({ id: "uj1", status: "new", score: 87 });
    const res = await GET(new Request("http://x"), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job.id).toBe("j1");
    expect(body.userJob.score).toBe(87);
  });
});

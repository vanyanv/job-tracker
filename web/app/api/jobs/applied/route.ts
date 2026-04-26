import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  url: z.string().url(),
  source: z.enum(["extension", "manual"]).optional(),
});

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

async function authenticate(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const incoming = header.slice(7).trim();
  if (!incoming) return null;
  const user = await prisma.user.findUnique({
    where: { apiKey: incoming },
    select: { id: true, apiKey: true },
  });
  if (!user) return null;
  return timingSafeEqualStrings(user.apiKey, incoming) ? user.id : null;
}

function normalizeJobUrl(input: string): string[] {
  const candidates = new Set<string>();
  try {
    const u = new URL(input);
    u.hash = "";
    u.search = "";
    let pathname = u.pathname.replace(/\/+$/, "");
    pathname = pathname
      .replace(/\/application$/i, "")
      .replace(/\/apply$/i, "")
      .replace(/\/thanks$/i, "")
      .replace(/\/confirmation$/i, "");
    u.pathname = pathname;
    candidates.add(u.toString());
    candidates.add(u.toString().replace(/\/$/, ""));
  } catch {
    // ignore
  }
  return Array.from(candidates);
}

export async function POST(req: NextRequest) {
  const userId = await authenticate(req);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const candidates = normalizeJobUrl(parsed.data.url);
  if (candidates.length === 0) {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  const job = await prisma.job.findFirst({
    where: { url: { in: candidates } },
    select: { id: true, url: true, title: true, company: true },
  });
  if (!job) {
    return NextResponse.json({ matched: false, error: "job_not_found" }, { status: 404 });
  }

  const existing = await prisma.userJob.findUnique({
    where: { userId_jobId: { userId, jobId: job.id } },
    select: { id: true, status: true },
  });

  if (existing?.status === "applied") {
    return NextResponse.json({ matched: true, jobId: job.id, userJobId: existing.id, noop: true });
  }

  const userJob = await prisma.userJob.upsert({
    where: { userId_jobId: { userId, jobId: job.id } },
    create: {
      userId,
      jobId: job.id,
      status: "applied",
      appliedAt: new Date(),
    },
    update: {
      status: "applied",
      appliedAt: new Date(),
    },
    select: { id: true, status: true, appliedAt: true },
  });

  return NextResponse.json({
    matched: true,
    jobId: job.id,
    userJobId: userJob.id,
    status: userJob.status,
    appliedAt: userJob.appliedAt,
    job: { title: job.title, company: job.company, url: job.url },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "new",
  "queued",
  "applied",
  "skipped",
  "rejected",
  "interview",
  "no_response",
]);

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const statuses = statusParam
    ? statusParam.split(",").map((s) => s.trim()).filter((s) => ALLOWED_STATUSES.has(s))
    : ["new", "queued"];

  const q = (url.searchParams.get("q") ?? "").trim();
  const minScore = clampInt(url.searchParams.get("minScore"), 0, 100, 0);
  const limit = clampInt(url.searchParams.get("limit"), 1, 100, 50);
  const offset = clampInt(url.searchParams.get("offset"), 0, 10_000, 0);
  const sort = url.searchParams.get("sort") === "fresh" ? "fresh" : "score";

  const where = {
    userId: user.id,
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(minScore > 0 ? { score: { gte: minScore } } : {}),
    ...(q
      ? {
          job: {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { company: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };

  const orderBy =
    sort === "fresh"
      ? [{ job: { postedAt: "desc" as const } }, { id: "desc" as const }]
      : [{ score: "desc" as const }, { job: { postedAt: "desc" as const } }, { id: "desc" as const }];

  const [items, total, counts] = await Promise.all([
    prisma.userJob.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        score: true,
        scoreReason: true,
        status: true,
        appliedAt: true,
        emailNote: true,
        job: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            url: true,
            source: true,
            postedAt: true,
            foundAt: true,
            snapshotUrl: true,
          },
        },
      },
    }),
    prisma.userJob.count({ where }),
    prisma.userJob.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
  ]);

  const countsByStatus: Record<string, number> = {};
  for (const c of counts) countsByStatus[c.status] = c._count._all;

  return NextResponse.json({ items, total, countsByStatus });
}

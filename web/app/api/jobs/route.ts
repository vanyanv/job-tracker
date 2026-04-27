import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "new", "queued", "applied", "skipped", "rejected", "interview", "no_response",
]);

function clampInt(v: string | null, min: number, max: number, fallback: number): number {
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function multi(v: string | null): string[] | undefined {
  if (!v) return undefined;
  const out = v.split(",").map((s) => s.trim()).filter(Boolean);
  return out.length ? out : undefined;
}
function parseDate(v: string | null): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(+d) ? undefined : d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sp = url.searchParams;

  const statuses = (multi(sp.get("status")) ?? ["new", "queued"]).filter((s) => ALLOWED_STATUSES.has(s));
  const q = (sp.get("q") ?? "").trim();
  const minScore = clampInt(sp.get("minScore"), 0, 100, 0);
  const limit = clampInt(sp.get("limit"), 1, 100, 50);
  const offset = clampInt(sp.get("offset"), 0, 10_000, 0);
  const sort = sp.get("sort") === "fresh" ? "fresh" : "score";

  const level = multi(sp.get("level"));
  const workMode = multi(sp.get("workMode"));
  const source = multi(sp.get("source"));
  const locationCountry = multi(sp.get("locationCountry"));
  const locationCity = multi(sp.get("locationCity"));
  const stackTags = multi(sp.get("stackTags"));
  const excludeCompanies = multi(sp.get("excludeCompanies"));
  const postedAfter = parseDate(sp.get("postedAfter"));
  const postedBefore = parseDate(sp.get("postedBefore"));
  const salaryMin = sp.get("salaryMin") !== null ? clampInt(sp.get("salaryMin"), 0, 1_000_000, 0) : undefined;
  const maxYoE = sp.get("maxYoE") !== null ? clampInt(sp.get("maxYoE"), 0, 50, 0) : undefined;

  const jobAnd: Record<string, unknown>[] = [];
  const jobWhere: Record<string, unknown> = {};
  if (level) jobWhere.level = { in: level };
  if (workMode) jobWhere.workMode = { in: workMode };
  if (source) jobWhere.source = { in: source };
  if (locationCountry) jobWhere.locationCountry = { in: locationCountry };
  if (locationCity) jobWhere.locationCity = { in: locationCity };
  if (stackTags) jobWhere.stackTags = { hasSome: stackTags };
  if (excludeCompanies) jobWhere.company = { notIn: excludeCompanies };
  if (postedAfter || postedBefore) {
    jobWhere.postedAt = {
      ...(postedAfter ? { gte: postedAfter } : {}),
      ...(postedBefore ? { lte: postedBefore } : {}),
    };
  }
  if (salaryMin !== undefined) jobWhere.salaryMax = { gte: salaryMin };
  if (maxYoE !== undefined) {
    jobAnd.push({ OR: [{ minYoE: null }, { minYoE: { lte: maxYoE } }] });
  }
  if (q) {
    jobAnd.push({
      OR: [
        { title: { contains: q, mode: "insensitive" as const } },
        { company: { contains: q, mode: "insensitive" as const } },
      ],
    });
  }
  if (jobAnd.length) jobWhere.AND = jobAnd;

  const where = {
    userId: user.id,
    ...(statuses.length ? { status: { in: statuses } } : {}),
    ...(minScore > 0 ? { score: { gte: minScore } } : {}),
    ...(Object.keys(jobWhere).length ? { job: jobWhere } : {}),
  };

  const orderBy =
    sort === "fresh"
      ? [{ job: { postedAt: "desc" as const } }, { id: "desc" as const }]
      : [{ score: "desc" as const }, { job: { postedAt: "desc" as const } }, { id: "desc" as const }];

  const [items, total, statusCounts] = await Promise.all([
    prisma.userJob.findMany({
      where, orderBy, take: limit, skip: offset,
      select: {
        id: true, score: true, scoreReason: true, status: true, appliedAt: true, emailNote: true,
        autoSkippedReason: true,
        job: {
          select: {
            id: true, title: true, company: true, location: true, url: true, source: true,
            postedAt: true, foundAt: true, snapshotUrl: true,
            level: true, workMode: true, locationCity: true, locationCountry: true,
            salaryMin: true, salaryMax: true, minYoE: true, stackTags: true,
          },
        },
      },
    }),
    prisma.userJob.count({ where }),
    prisma.userJob.groupBy({ by: ["status"], where: { userId: user.id }, _count: { _all: true } }),
  ]);

  const countsByStatus: Record<string, number> = {};
  for (const c of statusCounts) countsByStatus[c.status] = c._count._all;

  const facets = computeFacets(items as never);

  return NextResponse.json({ items, total, countsByStatus, facets });
}

interface FacetItem {
  job: {
    level?: string | null;
    workMode?: string | null;
    source: string;
    stackTags?: string[];
  };
}

function computeFacets(items: FacetItem[]) {
  const tally = (vals: (string | null | undefined)[]) => {
    const m: Record<string, number> = {};
    for (const v of vals) if (v) m[v] = (m[v] ?? 0) + 1;
    return m;
  };
  const stack: Record<string, number> = {};
  for (const it of items) for (const t of it.job.stackTags ?? []) stack[t] = (stack[t] ?? 0) + 1;
  return {
    level: tally(items.map((i) => i.job.level)),
    workMode: tally(items.map((i) => i.job.workMode)),
    source: tally(items.map((i) => i.job.source)),
    stackTags: stack,
  };
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AnalyticsShell } from "./_components/analytics-shell";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, image: true },
  });
  if (!user) redirect("/signin");

  const grouped = await prisma.userJob.groupBy({
    by: ["status"],
    where: { userId: user.id },
    _count: { _all: true },
  });
  const countsByStatus: Record<string, number> = {};
  for (const g of grouped) countsByStatus[g.status] = g._count._all;

  const responses = await prisma.userJob.findMany({
    where: { userId: user.id, appliedAt: { not: null } },
    orderBy: { appliedAt: "desc" },
    select: {
      id: true,
      status: true,
      score: true,
      appliedAt: true,
      job: { select: { source: true, company: true } },
    },
  });

  const scored = await prisma.userJob.findMany({
    where: { userId: user.id, score: { not: null } },
    select: { score: true, status: true },
  });

  const totalApplied = countsByStatus["applied"] ?? 0;
  const totalInterview = countsByStatus["interview"] ?? 0;
  const totalRejected = countsByStatus["rejected"] ?? 0;
  const totalNoResponse = countsByStatus["no_response"] ?? 0;
  const totalNew = countsByStatus["new"] ?? 0;
  const totalQueued = countsByStatus["queued"] ?? 0;
  const totalSkipped = countsByStatus["skipped"] ?? 0;
  const totalAll = grouped.reduce((acc: number, g) => acc + g._count._all, 0);

  const submitted = totalApplied + totalInterview + totalRejected + totalNoResponse;
  const responded = totalInterview + totalRejected;
  const responseRate = submitted ? responded / submitted : 0;
  const interviewRate = submitted ? totalInterview / submitted : 0;

  const appliedScores = responses
    .map((r) => r.score)
    .filter((s): s is number => typeof s === "number");
  const avgAppliedScore = appliedScores.length
    ? Math.round(appliedScores.reduce((a, b) => a + b, 0) / appliedScores.length)
    : null;

  // 90-day velocity buckets (Tabs can slice to 7/30/90)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = 90;
  const velocity: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    velocity.push({ date: d.toISOString().slice(0, 10), count: 0 });
  }
  const velocityIdx = new Map(velocity.map((b, i) => [b.date, i]));
  let last7 = 0;
  for (const r of responses) {
    if (!r.appliedAt) continue;
    const d = new Date(r.appliedAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const idx = velocityIdx.get(key);
    if (idx != null) {
      velocity[idx].count++;
      const ageDays = (today.getTime() - d.getTime()) / 86_400_000;
      if (ageDays < 7) last7++;
    }
  }

  // Score distribution buckets (over all scored userjobs)
  const histogram = [
    { label: "0–19", min: 0, max: 19, count: 0 },
    { label: "20–39", min: 20, max: 39, count: 0 },
    { label: "40–59", min: 40, max: 59, count: 0 },
    { label: "60–79", min: 60, max: 79, count: 0 },
    { label: "80+", min: 80, max: 100, count: 0 },
  ];
  for (const s of scored) {
    if (s.score == null) continue;
    const b = histogram.find((b) => s.score! >= b.min && s.score! <= b.max);
    if (b) b.count++;
  }

  // Source breakdown of submitted applications
  const sourceMap: Record<string, number> = {};
  for (const r of responses) {
    sourceMap[r.job.source] = (sourceMap[r.job.source] ?? 0) + 1;
  }
  const sources = Object.entries(sourceMap)
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);

  // Top companies applied to
  const companyMap: Record<string, number> = {};
  for (const r of responses) {
    companyMap[r.job.company] = (companyMap[r.job.company] ?? 0) + 1;
  }
  const topCompanies = Object.entries(companyMap)
    .map(([company, count]) => ({ company, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return (
    <AnalyticsShell
      user={{ email: user.email, name: user.name, image: user.image }}
      metrics={{
        totalAll,
        totalNew,
        totalQueued,
        totalApplied,
        totalInterview,
        totalRejected,
        totalNoResponse,
        totalSkipped,
        submitted,
        responseRate,
        interviewRate,
        avgAppliedScore,
        last7,
      }}
      velocity={velocity}
      histogram={histogram}
      sources={sources}
      topCompanies={topCompanies}
    />
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "./_components/dashboard-shell";
import type { FeedItem } from "./_components/job-feed";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/signin");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      gmailToken: true,
      resumeText: true,
      aiProvider: true,
      aiApiKey: true,
    },
  });
  if (!user) redirect("/signin");

  const counts = await prisma.userJob.groupBy({
    by: ["status"],
    where: { userId: user.id },
    _count: { _all: true },
  });
  const countsByStatus: Record<string, number> = {};
  for (const c of counts) countsByStatus[c.status] = c._count._all;

  const initialItems = await prisma.userJob.findMany({
    where: { userId: user.id, status: { in: ["new", "queued"] } },
    orderBy: [
      { score: "desc" },
      { job: { postedAt: "desc" } },
      { id: "desc" },
    ],
    take: 50,
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
  });

  return (
    <DashboardShell
      user={{
        email: user.email,
        name: user.name,
        image: user.image,
        gmailConnected: !!user.gmailToken,
        hasResume: !!user.resumeText,
        aiConfigured:
          user.aiProvider === "rules" || (!!user.aiProvider && !!user.aiApiKey),
      }}
      countsByStatus={countsByStatus}
      initialItems={initialItems.map(
        (it): FeedItem => ({
          id: it.id,
          score: it.score,
          scoreReason: it.scoreReason,
          status: it.status,
          appliedAt: it.appliedAt ? it.appliedAt.toISOString() : null,
          emailNote: it.emailNote,
          job: {
            id: it.job.id,
            title: it.job.title,
            company: it.job.company,
            location: it.job.location,
            url: it.job.url,
            source: it.job.source,
            postedAt: it.job.postedAt.toISOString(),
            foundAt: it.job.foundAt.toISOString(),
            snapshotUrl: it.job.snapshotUrl,
          },
        }),
      )}
    />
  );
}

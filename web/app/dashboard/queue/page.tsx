import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { QueueBoard } from "./_components/queue-board";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/signin");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, name: true, image: true },
  });
  if (!user) redirect("/signin");

  const items = await prisma.userJob.findMany({
    where: { userId: user.id, status: "queued" },
    orderBy: [
      { score: "desc" },
      { job: { postedAt: "desc" } },
      { id: "desc" },
    ],
    take: 200,
    select: {
      id: true,
      score: true,
      scoreReason: true,
      status: true,
      job: {
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          url: true,
          source: true,
          postedAt: true,
        },
      },
    },
  });

  const appliedToday = await prisma.userJob.count({
    where: {
      userId: user.id,
      status: "applied",
      appliedAt: { gte: startOfToday() },
    },
  });

  return (
    <QueueBoard
      user={{ email: user.email, name: user.name, image: user.image }}
      initialItems={JSON.parse(JSON.stringify(items))}
      appliedToday={appliedToday}
    />
  );
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCompany } from "@/lib/companies";

async function currentUser() {
  const session = await auth();
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, hiddenCompanies: true },
  });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ companies: user.hiddenCompanies });
}

const PostBody = z.object({ company: z.string().min(1) });

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = PostBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const norm = normalizeCompany(parsed.data.company);
  if (!norm) return NextResponse.json({ error: "invalid company" }, { status: 400 });
  if (user.hiddenCompanies.includes(norm)) {
    return NextResponse.json({ companies: user.hiddenCompanies });
  }

  const next = [...user.hiddenCompanies, norm];
  await prisma.user.update({ where: { id: user.id }, data: { hiddenCompanies: next } });

  // Retroactive: skip all matching new UserJobs
  const matching = await prisma.job.findMany({ select: { id: true, company: true } });
  const matchingIds = matching.filter((j) => normalizeCompany(j.company) === norm).map((j) => j.id);
  let skipped = 0;
  if (matchingIds.length) {
    const r = await prisma.userJob.updateMany({
      where: { userId: user.id, status: "new", jobId: { in: matchingIds } },
      data: { status: "skipped", autoSkippedReason: "hidden_company" },
    });
    skipped = r.count;
  }
  return NextResponse.json({ companies: next, skipped });
}

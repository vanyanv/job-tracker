import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeCompany } from "@/lib/companies";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ company: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, hiddenCompanies: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { company } = await ctx.params;
  const norm = normalizeCompany(decodeURIComponent(company));
  const next = user.hiddenCompanies.filter((c) => c !== norm);
  await prisma.user.update({ where: { id: user.id }, data: { hiddenCompanies: next } });

  const matching = await prisma.job.findMany({ select: { id: true, company: true } });
  const matchingIds = matching.filter((j) => normalizeCompany(j.company) === norm).map((j) => j.id);
  let restored = 0;
  if (matchingIds.length) {
    const r = await prisma.userJob.updateMany({
      where: {
        userId: user.id,
        status: "skipped",
        autoSkippedReason: "hidden_company",
        jobId: { in: matchingIds },
      },
      data: { status: "new", autoSkippedReason: null },
    });
    restored = r.count;
  }
  return NextResponse.json({ companies: next, restored });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const StatusSchema = z.object({
  status: z.enum(["new", "queued", "applied", "skipped", "rejected", "interview", "no_response"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const existing = await prisma.userJob.findUnique({
    where: { id },
    select: { userId: true, status: true },
  });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.userJob.update({
    where: { id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status === "applied" && existing.status !== "applied"
        ? { appliedAt: new Date() }
        : {}),
    },
    select: { id: true, status: true, appliedAt: true },
  });

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { FeedFiltersSchema } from "@/lib/feed-filters";

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.email) return null;
  const u = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return u?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = await prisma.savedSearch.findMany({
    where: { userId },
    orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ items });
}

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  filters: FeedFiltersSchema,
  sortIndex: z.number().int().optional(),
});

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }
  const item = await prisma.savedSearch.create({
    data: {
      userId,
      name: parsed.data.name,
      filters: parsed.data.filters,
      sortIndex: parsed.data.sortIndex ?? 0,
    },
  });
  return NextResponse.json({ item });
}

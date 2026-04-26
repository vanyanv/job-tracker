import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updated = await prisma.user.update({
    where: { email: session.user.email },
    data: { apiKey: randomUUID() },
    select: { apiKey: true },
  });

  return NextResponse.json({ ok: true, apiKey: updated.apiKey });
}

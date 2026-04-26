import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

const SUPPORTED_PROVIDERS = ["groq", "gemini", "claude", "rules"] as const;

const PatchBodySchema = z.object({
  aiProvider: z.enum(SUPPORTED_PROVIDERS).optional(),
  aiApiKey: z.string().min(1).max(500).optional().nullable(),
});

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      email: true,
      name: true,
      image: true,
      aiProvider: true,
      aiApiKey: true,
      gmailToken: true,
      apiKey: true,
      resumeText: true,
      resumeParsed: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    name: user.name,
    image: user.image,
    aiProvider: user.aiProvider ?? "rules",
    hasAiApiKey: !!user.aiApiKey,
    gmailConnected: !!user.gmailToken,
    apiKey: user.apiKey,
    hasResume: !!user.resumeText,
    resumeParsed: user.resumeParsed ?? null,
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { aiProvider, aiApiKey } = parsed.data;

  const data: { aiProvider?: string; aiApiKey?: string | null } = {};
  if (aiProvider !== undefined) data.aiProvider = aiProvider;
  if (aiApiKey !== undefined) {
    data.aiApiKey = aiApiKey === null || aiApiKey === "" ? null : encrypt(aiApiKey);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { email: session.user.email },
    data,
    select: { aiProvider: true, aiApiKey: true },
  });

  return NextResponse.json({
    ok: true,
    aiProvider: updated.aiProvider ?? "rules",
    hasAiApiKey: !!updated.aiApiKey,
  });
}

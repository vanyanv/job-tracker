import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, verifyState } from "@/lib/gmail";

function settingsRedirect(req: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL("/settings", req.url);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 302 });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return settingsRedirect(req, { gmail: "error", reason: errorParam });
  }
  if (!code || !state) {
    return settingsRedirect(req, { gmail: "error", reason: "missing_params" });
  }

  const stateUserId = verifyState(state);
  if (!stateUserId) {
    return settingsRedirect(req, { gmail: "error", reason: "bad_state" });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user || user.id !== stateUserId) {
    return settingsRedirect(req, { gmail: "error", reason: "user_mismatch" });
  }

  try {
    const token = await exchangeCode(code);
    await prisma.user.update({
      where: { id: user.id },
      data: { gmailToken: encrypt(JSON.stringify(token)) },
    });
  } catch (e) {
    console.error("[api/gmail/callback] exchange failed:", e);
    return settingsRedirect(req, {
      gmail: "error",
      reason: e instanceof Error ? e.message.slice(0, 80) : "exchange_failed",
    });
  }

  return settingsRedirect(req, { gmail: "connected" });
}

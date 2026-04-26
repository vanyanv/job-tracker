import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import {
  classifyEmail,
  extractSenderDomain,
  getMessageMeta,
  getValidAccessToken,
  listRecentMessages,
} from "@/lib/gmail";

type SyncErr = { context: string; error: string };
type SyncStats = {
  userId: string;
  processed: number;
  updated: number;
  markedNoResponse: number;
};

const STALE_AFTER_DAYS = 7;

function checkBearer(req: NextRequest): boolean {
  const token = process.env.EMAIL_SYNC_BEARER_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const incoming = header.slice(7);
  if (incoming.length !== token.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(incoming, "utf8"),
    Buffer.from(token, "utf8"),
  );
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function syncUser(
  userId: string,
  errors: SyncErr[],
): Promise<SyncStats | null> {
  let accessToken: string | null;
  try {
    accessToken = await getValidAccessToken(userId);
  } catch (e) {
    errors.push({ context: `user:${userId} token`, error: String(e) });
    return null;
  }
  if (!accessToken) return null;

  let refs: { id: string; threadId: string }[];
  try {
    refs = await listRecentMessages(accessToken, "newer_than:3d");
  } catch (e) {
    errors.push({ context: `user:${userId} list`, error: String(e) });
    return null;
  }

  const candidates = await prisma.userJob.findMany({
    where: {
      userId,
      status: { in: ["queued", "applied", "interview"] },
    },
    select: {
      id: true,
      status: true,
      job: { select: { company: true, title: true } },
    },
    orderBy: { appliedAt: "desc" },
  });

  const used = new Set<string>();
  let processed = 0;
  let updated = 0;

  for (const ref of refs) {
    let meta;
    try {
      meta = await getMessageMeta(accessToken, ref.id);
    } catch (e) {
      errors.push({ context: `user:${userId} msg:${ref.id}`, error: String(e) });
      continue;
    }
    if (!meta) continue;
    processed++;

    const cls = classifyEmail(meta.subject, meta.snippet);
    if (cls.kind === "unknown") continue;

    const senderDomain = extractSenderDomain(meta.from) ?? "";
    const haystack = `${meta.from} ${meta.subject} ${meta.snippet}`.toLowerCase();
    const senderDomainNorm = normalize(senderDomain);

    const match = candidates.find((c) => {
      if (used.has(c.id)) return false;
      const company = c.job.company;
      if (!company) return false;
      const companyNorm = normalize(company);
      if (companyNorm.length < 3) return false;
      if (haystack.includes(company.toLowerCase())) return true;
      if (senderDomainNorm.includes(companyNorm)) return true;
      return false;
    });
    if (!match) continue;

    const newStatus = cls.kind === "interview" ? "interview" : "rejected";
    if (match.status === newStatus) {
      used.add(match.id);
      continue;
    }

    try {
      await prisma.userJob.update({
        where: { id: match.id },
        data: {
          status: newStatus,
          emailNote: `${cls.kind === "interview" ? "Interview signal" : "Rejection signal"} ("${cls.matched}") — ${meta.subject.slice(0, 100)}`,
        },
      });
      used.add(match.id);
      updated++;
    } catch (e) {
      errors.push({
        context: `user:${userId} update:${match.id}`,
        error: String(e),
      });
    }
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  let markedNoResponse = 0;
  try {
    const result = await prisma.userJob.updateMany({
      where: {
        userId,
        status: "applied",
        appliedAt: { lt: cutoff },
      },
      data: {
        status: "no_response",
        emailNote: `No response after ${STALE_AFTER_DAYS} days`,
      },
    });
    markedNoResponse = result.count;
  } catch (e) {
    errors.push({ context: `user:${userId} stale`, error: String(e) });
  }

  return { userId, processed, updated, markedNoResponse };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.EMAIL_SYNC_BEARER_TOKEN) {
    console.error("[api/email/sync] EMAIL_SYNC_BEARER_TOKEN not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }
  if (!checkBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { gmailToken: { not: null } },
    select: { id: true },
  });

  const errors: SyncErr[] = [];
  const limit = pLimit(3);
  const results = await Promise.all(
    users.map((u) => limit(() => syncUser(u.id, errors))),
  );

  const totals = results.reduce(
    (acc, r) => {
      if (!r) return acc;
      acc.users++;
      acc.processed += r.processed;
      acc.updated += r.updated;
      acc.markedNoResponse += r.markedNoResponse;
      return acc;
    },
    { users: 0, processed: 0, updated: 0, markedNoResponse: 0 },
  );

  return NextResponse.json({
    ok: true,
    usersConsidered: users.length,
    ...totals,
    errors,
  });
}

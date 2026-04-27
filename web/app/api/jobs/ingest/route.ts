import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import pLimit from "p-limit";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/ai/provider";
import type { ResumeProfile } from "@/lib/ai/provider";
import { IngestBodySchema, type JobRecord } from "./schema";
import { tagAndUpdateNewJobs } from "./tagger-pass";

const SYSTEM_AI_MODEL = "llama-3.3-70b-versatile";

type IngestError = { context: string; error: string };
type EligibleUser = {
  id: string;
  aiProvider: string | null;
  aiApiKey: string | null;
  skillsProfile: string;
};
type JobInput = {
  title: string;
  company: string;
  location: string;
  description: string | null;
};

function checkBearer(req: NextRequest): boolean {
  const token = process.env.INGEST_BEARER_TOKEN;
  if (!token) return false;
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const incoming = authHeader.slice(7);
  if (incoming.length !== token.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(incoming, "utf8"),
    Buffer.from(token, "utf8"),
  );
}

interface UpsertResult {
  allJobIds: Map<string, string>;
  newJobIds: Set<string>;
}

async function upsertJobs(records: JobRecord[]): Promise<UpsertResult> {
  const incomingUrls = records.map((r) => r.url);
  const existing = await prisma.job.findMany({
    where: { url: { in: incomingUrls } },
    select: { url: true },
  });
  const existingUrlSet = new Set(existing.map((j) => j.url));

  const upserted = await Promise.all(
    records.map((r) =>
      prisma.job
        .upsert({
          where: { url: r.url },
          create: {
            url: r.url,
            title: r.title,
            company: r.company,
            location: r.location,
            description: r.description ?? null,
            source: r.source,
            postedAt: new Date(r.postedAt),
            snapshotUrl: r.snapshotUrl ?? null,
          },
          update: {
            title: r.title,
            company: r.company,
            location: r.location,
            description: r.description ?? null,
            snapshotUrl: r.snapshotUrl ?? null,
          },
          select: { id: true, url: true },
        })
        .catch((err) => {
          console.error(`[api/jobs/ingest] upsert failed for ${r.url}:`, err);
          return null;
        }),
    ),
  );

  const allJobIds = new Map<string, string>();
  const newJobIds = new Set<string>();
  for (const job of upserted) {
    if (!job) continue;
    allJobIds.set(job.url, job.id);
    if (!existingUrlSet.has(job.url)) newJobIds.add(job.id);
  }
  return { allJobIds, newJobIds };
}

async function scoreForUser(
  user: EligibleUser,
  newJobIds: Set<string>,
  jobInputMap: Map<string, JobInput>,
  errors: IngestError[],
): Promise<{ userJobsCreated: number; userJobsScored: number }> {
  if (newJobIds.size === 0) return { userJobsCreated: 0, userJobsScored: 0 };

  const profile: ResumeProfile = {
    skills: user.skillsProfile.split(",").map((s) => s.trim()).filter(Boolean),
    titles: [],
    yearsExperience: 0,
    summary: "",
  };

  const createData = Array.from(newJobIds).map((jobId) => ({
    userId: user.id,
    jobId,
    status: "new",
  }));

  let createdCount = 0;
  try {
    const result = await prisma.userJob.createMany({
      data: createData,
      skipDuplicates: true,
    });
    createdCount = result.count;
  } catch (err) {
    errors.push({ context: `user:${user.id} createMany`, error: String(err) });
    return { userJobsCreated: 0, userJobsScored: 0 };
  }

  const userJobs = await prisma.userJob.findMany({
    where: { userId: user.id, jobId: { in: Array.from(newJobIds) } },
    select: { id: true, jobId: true },
  });

  const provider = getProvider(user);
  let scoredCount = 0;
  for (const uj of userJobs) {
    const jobInput = jobInputMap.get(uj.jobId);
    if (!jobInput) continue;
    try {
      const result = await provider.scoreJob(jobInput, profile);
      await prisma.userJob.update({
        where: { id: uj.id },
        data: { score: result.score, scoreReason: result.reason },
      });
      scoredCount++;
    } catch (err) {
      errors.push({ context: `user:${user.id} job:${uj.jobId}`, error: String(err) });
    }
  }
  return { userJobsCreated: createdCount, userJobsScored: scoredCount };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.INGEST_BEARER_TOKEN) {
    console.error("[api/jobs/ingest] INGEST_BEARER_TOKEN is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (!checkBearer(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = IngestBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { jobs: records } = parsed.data;
  const { allJobIds, newJobIds } = await upsertJobs(records);

  const systemAiKey = process.env.SYSTEM_AI_API_KEY;
  const taggerStats = systemAiKey
    ? await tagAndUpdateNewJobs(prisma, newJobIds, { apiKey: systemAiKey, model: SYSTEM_AI_MODEL })
    : { tagged: 0, failed: 0 };
  if (!systemAiKey) console.warn("[ingest] SYSTEM_AI_API_KEY unset; skipping tagger");

  const eligibleRaw = await prisma.user.findMany({
    where: { skillsProfile: { not: null } },
    select: { id: true, aiProvider: true, aiApiKey: true, skillsProfile: true },
  });
  const eligibleUsers: EligibleUser[] = eligibleRaw.filter(
    (u): u is EligibleUser => u.skillsProfile !== null,
  );

  const jobInputMap = new Map<string, JobInput>();
  for (const r of records) {
    const id = allJobIds.get(r.url);
    if (id) {
      jobInputMap.set(id, {
        title: r.title,
        company: r.company,
        location: r.location,
        description: r.description ?? null,
      });
    }
  }

  const errors: IngestError[] = [];
  const limit = pLimit(3);
  const scoringResults = await Promise.all(
    eligibleUsers.map((user) =>
      limit(() => scoreForUser(user, newJobIds, jobInputMap, errors)),
    ),
  );

  const totalUserJobsCreated = scoringResults.reduce((sum, r) => sum + r.userJobsCreated, 0);
  const totalUserJobsScored = scoringResults.reduce((sum, r) => sum + r.userJobsScored, 0);

  return NextResponse.json({
    ok: true,
    jobsReceived: records.length,
    jobsNew: newJobIds.size,
    jobsExisting: allJobIds.size - newJobIds.size,
    userJobsCreated: totalUserJobsCreated,
    userJobsScored: totalUserJobsScored,
    taggerStats,
    errors,
  });
}

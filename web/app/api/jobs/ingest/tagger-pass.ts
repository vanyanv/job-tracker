import pLimit from "p-limit";
import { tagJob } from "@/lib/ai/tagger";
import type { PrismaClient } from "@prisma/client";

export async function tagAndUpdateNewJobs(
  db: Pick<PrismaClient, "job">,
  newJobIds: Set<string>,
  cfg: { apiKey: string; model: string },
): Promise<{ tagged: number; failed: number }> {
  if (newJobIds.size === 0) return { tagged: 0, failed: 0 };
  const jobs = await db.job.findMany({
    where: { id: { in: Array.from(newJobIds) } },
    select: { id: true, title: true, company: true, location: true, description: true },
  });
  const limit = pLimit(3);
  let tagged = 0, failed = 0;
  await Promise.all(jobs.map((j) => limit(async () => {
    try {
      const tags = await tagJob(
        { title: j.title, company: j.company, locationRaw: j.location, description: j.description },
        cfg,
      );
      await db.job.update({
        where: { id: j.id },
        data: {
          level: tags.level,
          workMode: tags.workMode,
          locationCity: tags.locationCity,
          locationCountry: tags.locationCountry,
          salaryMin: tags.salaryMin,
          salaryMax: tags.salaryMax,
          minYoE: tags.minYoE,
          stackTags: tags.stackTags,
          taggedAt: new Date(),
          tagModel: cfg.model,
        },
      });
      tagged++;
    } catch (err) {
      console.error(`[ingest] tag failed for ${j.id}:`, err);
      failed++;
    }
  })));
  return { tagged, failed };
}

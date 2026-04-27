import { PrismaClient } from "@prisma/client";
import pLimit from "p-limit";
import { tagJob } from "@/lib/ai/tagger";

const MODEL = "llama-3.3-70b-versatile";
const BATCH = 100;

async function main() {
  const apiKey = process.env.SYSTEM_AI_API_KEY;
  if (!apiKey) {
    console.error("SYSTEM_AI_API_KEY required");
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const limit = pLimit(3);
  let total = 0;

  while (true) {
    const jobs = await prisma.job.findMany({
      where: { taggedAt: null },
      take: BATCH,
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        description: true,
      },
    });
    if (jobs.length === 0) break;
    await Promise.all(
      jobs.map((j) =>
        limit(async () => {
          const tags = await tagJob(
            {
              title: j.title,
              company: j.company,
              locationRaw: j.location,
              description: j.description,
            },
            { apiKey, model: MODEL },
          );
          await prisma.job.update({
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
              tagModel: MODEL,
            },
          });
          total++;
          if (total % 25 === 0) console.log(`[backfill] tagged=${total}`);
        }),
      ),
    );
  }
  console.log(`[backfill] done, total=${total}`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

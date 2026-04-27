// One-off backfill: create UserJob entries (with rules-based scores) for every
// Job that doesn't already have one for each user with a skillsProfile.
// Run from /web with: node --env-file=.env.local scripts/backfill-user-jobs.mjs

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function scoreWithRules(job, skills) {
  if (skills.length === 0) return { score: 0, reason: "No skills in profile." };
  const text = `${job.title} ${job.description ?? ""}`.toLowerCase();
  const matched = [];
  for (const s of skills) {
    const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${esc}\\b`, "i").test(text)) matched.push(s);
  }
  const score = Math.min(100, Math.round((matched.length / skills.length) * 100));
  const reason =
    matched.length === 0
      ? "No resume skills found in job description."
      : `Matched ${matched.length} of ${skills.length} skills: ${matched.slice(0, 5).join(", ")}${matched.length > 5 ? ", ..." : ""}.`;
  return { score, reason };
}

const users = await prisma.user.findMany({
  where: { skillsProfile: { not: null } },
  select: { id: true, email: true, skillsProfile: true },
});

console.log(`Found ${users.length} user(s) with skillsProfile.`);

for (const user of users) {
  const skills = user.skillsProfile.split(",").map((s) => s.trim()).filter(Boolean);
  console.log(`\nUser ${user.email}: ${skills.length} skills`);

  const existing = await prisma.userJob.findMany({
    where: { userId: user.id },
    select: { jobId: true },
  });
  const existingJobIds = new Set(existing.map((u) => u.jobId));

  const missingJobs = await prisma.job.findMany({
    where: { id: { notIn: Array.from(existingJobIds).length ? Array.from(existingJobIds) : ["__none__"] } },
    select: { id: true, title: true, description: true },
  });

  console.log(`  ${existing.length} existing UserJob(s), ${missingJobs.length} to backfill`);

  let created = 0;
  for (const j of missingJobs) {
    const { score, reason } = scoreWithRules(j, skills);
    try {
      await prisma.userJob.create({
        data: { userId: user.id, jobId: j.id, status: "new", score, scoreReason: reason },
      });
      created++;
    } catch (err) {
      console.error(`  failed for job ${j.id}:`, err.message);
    }
  }
  console.log(`  created ${created} UserJob(s)`);
}

await prisma.$disconnect();
console.log("\nDone.");

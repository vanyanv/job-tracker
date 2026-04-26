import type { AIProvider, JobInput, ResumeProfile, ScoreResult } from "./provider";
import { ResumeProfileSchema } from "./provider";

const TECH_SKILLS = [
  "TypeScript", "JavaScript", "Python", "Go", "Rust", "Java", "C++", "C#",
  "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Elixir",
  "React", "Next.js", "Vue", "Angular", "Svelte", "Remix",
  "Node.js", "Express", "Fastify", "NestJS", "Hono",
  "PostgreSQL", "MySQL", "SQLite", "MongoDB", "Redis", "Elasticsearch",
  "GraphQL", "REST", "gRPC", "tRPC",
  "Docker", "Kubernetes", "Terraform", "Ansible",
  "AWS", "GCP", "Azure", "Vercel", "Cloudflare",
  "GitHub Actions", "CircleCI", "Jenkins",
  "Prisma", "Drizzle", "TypeORM", "SQLAlchemy",
  "Playwright", "Cypress", "Jest", "Vitest", "pytest",
  "React Native", "Flutter", "Expo",
  "PyTorch", "TensorFlow", "LangChain",
  "Linux", "Bash", "Git", "Vite", "Webpack",
  "Figma", "Tailwind CSS", "CSS", "HTML",
  "OpenAPI",
] as const;

const TITLE_PATTERN =
  /^(senior|staff|lead|principal|founding)?\s*(software|frontend|front-end|backend|back-end|full.?stack|platform|infrastructure|devops|site reliability|mobile|ios|android|data|ml|ai)\s*(engineer|developer|architect|scientist|analyst)/im;

const YEARS_PATTERN =
  /(\d+)\+?\s+years?\s+(?:of\s+)?(?:professional\s+)?(?:software\s+)?experience/i;

export class RulesProvider implements AIProvider {
  async scoreJob(job: JobInput, profile: ResumeProfile): Promise<ScoreResult> {
    if (profile.skills.length === 0) {
      return { score: 0, reason: "No skills in resume profile to match against." };
    }
    const jobText = `${job.title} ${job.description ?? ""}`.toLowerCase();
    const matched: string[] = [];
    for (const skill of profile.skills) {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`, "i").test(jobText)) {
        matched.push(skill);
      }
    }
    const score = Math.min(100, Math.round((matched.length / profile.skills.length) * 100));
    const reason =
      matched.length === 0
        ? "No resume skills found in job description."
        : `Matched ${matched.length} of ${profile.skills.length} skills: ${matched.slice(0, 5).join(", ")}${matched.length > 5 ? ", ..." : ""}.`;
    return { score, reason };
  }

  async parseResume(resumeText: string): Promise<ResumeProfile> {
    const skills = (TECH_SKILLS as readonly string[]).filter((skill) =>
      new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(resumeText)
    );
    const lines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean);
    const titles: string[] = [];
    for (const line of lines) {
      if (TITLE_PATTERN.test(line) && line.length < 80) {
        titles.push(line);
        if (titles.length >= 5) break;
      }
    }
    const yearsMatch = resumeText.match(YEARS_PATTERN);
    const yearsExperience = yearsMatch ? parseInt(yearsMatch[1], 10) : 0;
    const paragraphs = resumeText.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length >= 50);
    const summary = (paragraphs[0] ?? resumeText).slice(0, 300);
    return ResumeProfileSchema.parse({ skills, titles, yearsExperience, summary });
  }
}

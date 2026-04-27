import Groq from "groq-sdk";
import { JobTagsSchema, type JobTags, type JobToTag } from "./tagger-types";
import { normalizeStackTags } from "./stack-aliases";

const SYSTEM_PROMPT =
  `You are a job-listing tagger. Read the job posting and respond ONLY with JSON of this shape:\n` +
  `{"level":"intern|junior|mid|senior|staff|principal|manager|director|unknown",` +
  `"workMode":"remote|hybrid|onsite|unknown",` +
  `"locationCity":string|null,"locationCountry":string|null,` +
  `"salaryMin":int|null,"salaryMax":int|null,` +
  `"minYoE":int|null,` +
  `"stackTags":[string up to 8]}\n` +
  `Salaries in USD. minYoE is the minimum years stated (5 for "5+ years"). ` +
  `stackTags are concrete technologies (react, typescript, postgresql, kubernetes, …). ` +
  `No markdown, no commentary.`;

const FALLBACK: JobTags = {
  level: "unknown", workMode: "unknown",
  locationCity: null, locationCountry: null,
  salaryMin: null, salaryMax: null, minYoE: null, stackTags: [],
};

export interface TaggerConfig { apiKey: string; model: string; }

export async function tagJob(job: JobToTag, cfg: TaggerConfig): Promise<JobTags> {
  const client = new Groq({ apiKey: cfg.apiKey });
  const userContent = [
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location (raw): ${job.locationRaw}`,
    job.description ? `Description:\n${job.description.slice(0, 8000)}` : "",
  ].filter(Boolean).join("\n");

  let raw = "";
  try {
    const res = await client.chat.completions.create({
      model: cfg.model,
      response_format: { type: "json_object" },
      temperature: 0.0,
      max_tokens: 400,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    });
    raw = res.choices[0]?.message?.content ?? "";
  } catch {
    return FALLBACK;
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return FALLBACK; }

  const safe = JobTagsSchema.safeParse(parsed);
  const tags = safe.success ? safe.data : FALLBACK;
  return { ...tags, stackTags: normalizeStackTags(tags.stackTags) };
}

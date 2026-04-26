import Groq from "groq-sdk";
import type { AIProvider, JobInput, ResumeProfile, ScoreResult } from "./provider";
import { ScoreResultSchema, ResumeProfileSchema } from "./provider";

const MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements AIProvider {
  private client: Groq;

  constructor(apiKey: string) {
    this.client = new Groq({ apiKey });
  }

  async scoreJob(job: JobInput, profile: ResumeProfile): Promise<ScoreResult> {
    const userContent = [
      `Job title: ${job.title}`,
      `Company: ${job.company}`,
      `Location: ${job.location}`,
      job.description ? `Description: ${job.description.slice(0, 3000)}` : "",
      ``,
      `Candidate skills: ${profile.skills.join(", ")}`,
      `Years of experience: ${profile.yearsExperience}`,
    ].filter(Boolean).join("\n");

    const completion = await this.client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 128,
      messages: [
        {
          role: "system",
          content:
            'You are a job-fit analyst. Score how well this job matches the candidate. ' +
            'Respond ONLY with valid JSON: {"score": <integer 0-100>, "reason": "<one sentence>"}. ' +
            'No markdown. No text outside the JSON.',
        },
        { role: "user", content: userContent },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return ScoreResultSchema.parse(JSON.parse(raw));
  }

  async parseResume(resumeText: string): Promise<ResumeProfile> {
    const schemaHint = '{"skills": ["string"], "titles": ["string"], "yearsExperience": integer, "summary": "string"}';
    const completion = await this.client.chat.completions.create({
      model: MODEL,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            `Extract structured data from the resume. ` +
            `Respond ONLY with valid JSON matching this shape: ${schemaHint}. ` +
            `No markdown. No text outside the JSON.`,
        },
        { role: "user", content: resumeText.slice(0, 8000) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    return ResumeProfileSchema.parse(JSON.parse(raw));
  }
}

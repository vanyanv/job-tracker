import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { AIProvider, JobInput, ResumeProfile, ScoreResult } from "./provider";
import { ScoreResultSchema, ResumeProfileSchema } from "./provider";

const MODEL = "gemini-2.5-flash";

export class GeminiProvider implements AIProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async scoreJob(job: JobInput, profile: ResumeProfile): Promise<ScoreResult> {
    const prompt = [
      `Score how well this job matches the candidate's resume. Return score 0–100 and a one-sentence reason.`,
      `Job title: ${job.title}`,
      `Company: ${job.company}`,
      `Location: ${job.location}`,
      job.description ? `Description: ${job.description.slice(0, 3000)}` : "",
      `Candidate skills: ${profile.skills.join(", ")}`,
      `Years of experience: ${profile.yearsExperience}`,
    ].filter(Boolean).join("\n");

    const response = await this.ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(ScoreResultSchema),
      },
    });

    return ScoreResultSchema.parse(JSON.parse(response.text ?? "{}"));
  }

  async parseResume(resumeText: string): Promise<ResumeProfile> {
    const response = await this.ai.models.generateContent({
      model: MODEL,
      contents: `Extract structured data from the following resume:\n\n${resumeText.slice(0, 8000)}`,
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(ResumeProfileSchema),
      },
    });

    return ResumeProfileSchema.parse(JSON.parse(response.text ?? "{}"));
  }
}

import { z } from "zod";
import { decrypt } from "@/lib/crypto";

export const ResumeProfileSchema = z.object({
  skills: z.array(z.string())
    .describe("Technical skills, tools, and frameworks the candidate knows"),
  titles: z.array(z.string())
    .describe("Job titles the candidate has held or is targeting"),
  yearsExperience: z.number().int().min(0)
    .describe("Total years of professional software engineering experience"),
  summary: z.string()
    .describe("Two-sentence professional summary"),
});
export type ResumeProfile = z.infer<typeof ResumeProfileSchema>;

export const ScoreResultSchema = z.object({
  score: z.number().int().min(0).max(100)
    .describe("Match score 0–100; 100 = perfect match"),
  reason: z.string()
    .describe("One-sentence explanation of the score"),
});
export type ScoreResult = z.infer<typeof ScoreResultSchema>;

export interface JobInput {
  title: string;
  company: string;
  location: string;
  description: string | null;
}

export interface AIProvider {
  scoreJob(job: JobInput, profile: ResumeProfile): Promise<ScoreResult>;
  parseResume(resumeText: string): Promise<ResumeProfile>;
}

export type UserForProvider = {
  aiProvider: string | null;
  aiApiKey: string | null;
};

import { RulesProvider } from "./rules";
import { GroqProvider } from "./groq";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";

export function getProvider(user: UserForProvider): AIProvider {
  if (!user.aiProvider || !user.aiApiKey) return new RulesProvider();
  let apiKey: string;
  try {
    apiKey = decrypt(user.aiApiKey);
  } catch {
    return new RulesProvider();
  }
  switch (user.aiProvider) {
    case "groq":   return new GroqProvider(apiKey);
    case "gemini": return new GeminiProvider(apiKey);
    case "claude": return new ClaudeProvider(apiKey);
    default:       return new RulesProvider();
  }
}

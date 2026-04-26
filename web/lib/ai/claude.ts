import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { AIProvider, JobInput, ResumeProfile, ScoreResult } from "./provider";
import { ScoreResultSchema, ResumeProfileSchema } from "./provider";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model ?? DEFAULT_MODEL;
  }

  async scoreJob(job: JobInput, profile: ResumeProfile): Promise<ScoreResult> {
    const prompt = [
      `Score how well this job matches the candidate's resume.`,
      `Job: ${job.title} at ${job.company} (${job.location})`,
      job.description ? `Description: ${job.description.slice(0, 3000)}` : "",
      `Candidate skills: ${profile.skills.join(", ")}`,
      `Years of experience: ${profile.yearsExperience}`,
    ].filter(Boolean).join("\n");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 256,
      tool_choice: { type: "any" },
      tools: [{
        name: "submit_score",
        description: "Submit the job relevance score for this candidate.",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: z.toJSONSchema(ScoreResultSchema) as any,
      }],
      messages: [{ role: "user", content: prompt }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not call the submit_score tool.");
    }
    return ScoreResultSchema.parse(toolUse.input);
  }

  async parseResume(resumeText: string): Promise<ResumeProfile> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      tool_choice: { type: "any" },
      tools: [{
        name: "submit_resume_profile",
        description: "Submit the structured resume profile extracted from the text.",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        input_schema: z.toJSONSchema(ResumeProfileSchema) as any,
      }],
      messages: [{
        role: "user",
        content: `Extract structured data from this resume:\n\n${resumeText.slice(0, 8000)}`,
      }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new Error("Claude did not call the submit_resume_profile tool.");
    }
    return ResumeProfileSchema.parse(toolUse.input);
  }
}

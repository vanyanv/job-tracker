import { z } from "zod";

export const LEVELS = [
  "intern", "junior", "mid", "senior", "staff", "principal", "manager", "director", "unknown",
] as const;

export const WORK_MODES = ["remote", "hybrid", "onsite", "unknown"] as const;

export const JobTagsSchema = z.object({
  level: z.enum(LEVELS).default("unknown"),
  workMode: z.enum(WORK_MODES).default("unknown"),
  locationCity: z.string().nullable().default(null),
  locationCountry: z.string().nullable().default(null),
  salaryMin: z.number().int().nullable().default(null),
  salaryMax: z.number().int().nullable().default(null),
  minYoE: z.number().int().min(0).max(50).nullable().default(null),
  stackTags: z.array(z.string()).default([]),
});

export type JobTags = z.infer<typeof JobTagsSchema>;

export interface JobToTag {
  title: string;
  company: string;
  locationRaw: string;
  description: string | null;
}

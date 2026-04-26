import { z } from "zod";

export const JobRecordSchema = z.object({
  url: z.url(),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().min(1),
  description: z.string().nullable().optional(),
  source: z.enum(["ashby", "greenhouse", "lever"]),
  postedAt: z.iso.datetime(),
  snapshotUrl: z.url().nullable().optional(),
});

export const IngestBodySchema = z.object({
  jobs: z.array(JobRecordSchema).min(1).max(200),
});

export type JobRecord = z.infer<typeof JobRecordSchema>;
export type IngestBody = z.infer<typeof IngestBodySchema>;

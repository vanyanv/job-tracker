import { z } from "zod";

export const FeedFiltersSchema = z
  .object({
    status: z.array(z.string()).optional(),
    source: z.array(z.string()).optional(),
    level: z.array(z.string()).optional(),
    workMode: z.array(z.string()).optional(),
    locationCountry: z.array(z.string()).optional(),
    locationCity: z.array(z.string()).optional(),
    stackTags: z.array(z.string()).optional(),
    excludeCompanies: z.array(z.string()).optional(),
    postedAfter: z.string().datetime().optional(),
    postedBefore: z.string().datetime().optional(),
    salaryMin: z.number().int().min(0).optional(),
    maxYoE: z.number().int().min(0).max(50).optional(),
    minScore: z.number().int().min(0).max(100).optional(),
    q: z.string().optional(),
    sort: z.enum(["score", "fresh"]).optional(),
  })
  .strict();

export type FeedFilters = z.infer<typeof FeedFiltersSchema>;

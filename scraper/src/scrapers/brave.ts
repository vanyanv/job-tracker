import pLimit from "p-limit";
import { braveSearch } from "../utils/brave.js";
import { classifyUrl } from "../utils/classify.js";
import { fetchOneAshby } from "./ashby.js";
import { fetchOneGreenhouse } from "./greenhouse.js";
import { fetchOneLever } from "./lever.js";
import type { JobRecord } from "../types.js";

const SITE_RESTRICT =
  "(site:ashbyhq.com OR site:boards.greenhouse.io OR site:jobs.lever.co)";

export interface BraveLaneConfig {
  apiKey: string;
  queries: string[];
  country?: string;
}

export async function scrapeBrave(cfg: BraveLaneConfig): Promise<JobRecord[]> {
  const out: JobRecord[] = [];
  const limit = pLimit(5);
  for (const role of cfg.queries) {
    const results = await braveSearch({
      q: `${role} ${SITE_RESTRICT}`,
      apiKey: cfg.apiKey,
      count: 20,
      freshness: "pd",
      country: cfg.country ?? "us",
    });
    const enriched = await Promise.all(
      results.map((r) =>
        limit(async (): Promise<JobRecord | null> => {
          const c = classifyUrl(r.url);
          if (!c) return null;
          try {
            if (c.ats === "ashby") return await fetchOneAshby(c.org, c.jobId);
            if (c.ats === "greenhouse") return await fetchOneGreenhouse(c.org, c.jobId);
            if (c.ats === "lever") return await fetchOneLever(c.org, c.jobId);
          } catch {
            return null;
          }
          return null;
        }),
      ),
    );
    for (const j of enriched) if (j) out.push(j);
  }
  return out;
}

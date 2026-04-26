import { scrapeAshby } from "./scrapers/ashby.js";
import { scrapeGreenhouse } from "./scrapers/greenhouse.js";
import { scrapeLever } from "./scrapers/lever.js";
import { filterJobs } from "./utils/filter.js";
import { ingestJobs } from "./utils/ingest.js";
import type { JobRecord } from "./types.js";

async function main(): Promise<void> {
  const vercelUrl = process.env.VERCEL_URL;
  const ingestToken = process.env.INGEST_BEARER_TOKEN;
  if (!vercelUrl || !ingestToken) {
    console.error("[scraper] FATAL: VERCEL_URL and INGEST_BEARER_TOKEN must be set");
    process.exit(1);
  }

  const hoursWindow = parseInt(process.env.SCRAPER_HOURS_WINDOW ?? "24", 10);
  console.log(`[scraper] hoursWindow=${hoursWindow} target=${vercelUrl}`);

  const [ashbyResult, greenhouseResult, leverResult] = await Promise.allSettled([
    scrapeAshby(),
    scrapeGreenhouse(),
    scrapeLever(),
  ]);

  function settle(
    source: string,
    result: PromiseSettledResult<JobRecord[]>,
  ): JobRecord[] {
    if (result.status === "fulfilled") {
      console.log(`[scraper] source=${source} scraped=${result.value.length}`);
      return result.value;
    }
    console.error(`[scraper] source=${source} FAILED: ${String(result.reason)}`);
    return [];
  }

  const all = [
    ...settle("ashby", ashbyResult),
    ...settle("greenhouse", greenhouseResult),
    ...settle("lever", leverResult),
  ];

  const deduped = Array.from(new Map(all.map((j) => [j.url, j])).values());
  const filtered = filterJobs(deduped, { hoursWindow });

  console.log(
    `[scraper] merged=${all.length} deduped=${deduped.length} after-filter=${filtered.length}`,
  );

  if (filtered.length === 0) {
    console.log("[scraper] no jobs matched filters — nothing to ingest");
    process.exit(0);
  }

  const { sent, errors } = await ingestJobs(filtered);
  console.log(`[scraper] ingested=${sent} ingest-errors=${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[scraper] unhandled fatal error:", err);
  process.exit(1);
});

import { scrapeAshby } from "./scrapers/ashby.js";
import { scrapeGreenhouse } from "./scrapers/greenhouse.js";
import { scrapeLever } from "./scrapers/lever.js";
import { scrapeBrave } from "./scrapers/brave.js";
import { filterJobs } from "./utils/filter.js";
import { ingestJobs } from "./utils/ingest.js";
import { snapshotJobs } from "./utils/snapshot.js";
import type { JobRecord } from "./types.js";

const DEFAULT_QUERIES = ["software engineer", "frontend engineer", "backend engineer"];

function readQueries(): string[] {
  const raw = process.env.SEARCH_QUERIES_JSON;
  if (!raw) return DEFAULT_QUERIES;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((q) => typeof q === "string" && q.length > 0)) {
      return parsed;
    }
  } catch {
    // fall through
  }
  console.warn("[scraper] SEARCH_QUERIES_JSON invalid, using defaults");
  return DEFAULT_QUERIES;
}

async function main(): Promise<void> {
  const vercelUrl = process.env.VERCEL_URL;
  const ingestToken = process.env.INGEST_BEARER_TOKEN;
  if (!vercelUrl || !ingestToken) {
    console.error("[scraper] FATAL: VERCEL_URL and INGEST_BEARER_TOKEN must be set");
    process.exit(1);
  }
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  const hoursWindow = parseInt(process.env.SCRAPER_HOURS_WINDOW ?? "24", 10);
  console.log(`[scraper] hoursWindow=${hoursWindow} target=${vercelUrl} brave=${Boolean(braveKey)}`);

  const tasks: Array<Promise<JobRecord[]>> = [
    scrapeAshby(),
    scrapeGreenhouse(),
    scrapeLever(),
  ];
  const labels = ["ashby", "greenhouse", "lever"];
  if (braveKey) {
    tasks.push(scrapeBrave({ apiKey: braveKey, queries: readQueries() }));
    labels.push("brave");
  } else {
    console.warn("[scraper] BRAVE_SEARCH_API_KEY unset; skipping Brave lane");
  }

  const settled = await Promise.allSettled(tasks);
  const all: JobRecord[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      console.log(`[scraper] source=${labels[i]} scraped=${r.value.length}`);
      all.push(...r.value);
    } else {
      console.error(`[scraper] source=${labels[i]} FAILED: ${String(r.reason)}`);
    }
  });

  const deduped = Array.from(new Map(all.map((j) => [j.url, j])).values());
  const filtered = filterJobs(deduped, { hoursWindow });

  console.log(
    `[scraper] merged=${all.length} deduped=${deduped.length} after-filter=${filtered.length}`,
  );

  if (filtered.length === 0) {
    console.log("[scraper] no jobs matched filters — nothing to ingest");
    process.exit(0);
  }

  const snapshotted = await snapshotJobs(filtered);
  const withSnapshots = snapshotted.filter((j) => j.snapshotUrl !== null).length;
  console.log(`[scraper] snapshots=${withSnapshots}/${snapshotted.length}`);

  const { sent, errors } = await ingestJobs(snapshotted);
  console.log(`[scraper] ingested=${sent} ingest-errors=${errors}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[scraper] unhandled fatal error:", err);
  process.exit(1);
});

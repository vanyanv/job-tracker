import pLimit from "p-limit";
import { GREENHOUSE_ORGS, orgToCompany } from "../orgs.js";
import type { JobRecord } from "../types.js";

interface GreenhouseJob {
  title: string;
  updated_at: string;
  absolute_url: string;
  location?: { name: string };
  content?: string;
}

function stripHtml(html: string): string | null {
  const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped || null;
}

async function fetchOrgGreenhouse(org: string): Promise<JobRecord[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${org}/jobs?content=true`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[greenhouse] ${org} HTTP ${res.status} — skipping`);
      return [];
    }
    const data = (await res.json()) as { jobs?: GreenhouseJob[] };
    return (data.jobs ?? [])
      .filter((j) => j.updated_at)
      .map((j): JobRecord => ({
        url: j.absolute_url,
        title: j.title,
        company: orgToCompany(org),
        location: j.location?.name ?? "",
        description: stripHtml(j.content ?? ""),
        source: "greenhouse",
        postedAt: j.updated_at,
        snapshotUrl: null,
      }));
  } catch (err) {
    console.warn(`[greenhouse] ${org} error: ${String(err)}`);
    return [];
  }
}

export async function scrapeGreenhouse(): Promise<JobRecord[]> {
  const limit = pLimit(5);
  const results = await Promise.all(
    GREENHOUSE_ORGS.map((org) => limit(() => fetchOrgGreenhouse(org))),
  );
  return results.flat();
}

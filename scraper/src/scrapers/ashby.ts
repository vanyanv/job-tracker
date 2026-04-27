import pLimit from "p-limit";
import { ASHBY_ORGS, orgToCompany } from "../orgs.js";
import type { JobRecord } from "../types.js";

interface AshbyJob {
  title: string;
  publishedAt: string | null;
  jobUrl: string;
  location: string;
  workplaceType: string;
  descriptionPlain?: string;
  isListed: boolean;
}

async function fetchOrgAshby(org: string): Promise<JobRecord[]> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${org}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[ashby] ${org} HTTP ${res.status} — skipping`);
      return [];
    }
    const data = (await res.json()) as { jobs?: AshbyJob[] };
    return (data.jobs ?? [])
      .filter((j) => j.isListed === true && j.publishedAt)
      .map((j): JobRecord => ({
        url: j.jobUrl,
        title: j.title,
        company: orgToCompany(org),
        location: j.location || j.workplaceType || "",
        description: j.descriptionPlain ?? null,
        source: "ashby",
        postedAt: new Date(j.publishedAt!).toISOString(),
        snapshotUrl: null,
      }));
  } catch (err) {
    console.warn(`[ashby] ${org} error: ${String(err)}`);
    return [];
  }
}

export async function scrapeAshby(): Promise<JobRecord[]> {
  const limit = pLimit(5);
  const results = await Promise.all(
    ASHBY_ORGS.map((org) => limit(() => fetchOrgAshby(org))),
  );
  return results.flat();
}

export async function fetchOneAshby(
  org: string,
  jobId: string,
  company?: string,
): Promise<JobRecord | null> {
  const url = `https://api.ashbyhq.com/posting-api/job-board/${org}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { jobs?: AshbyJob[] };
    const j = (data.jobs ?? []).find(
      (x) => x.jobUrl?.endsWith(`/${jobId}`) && x.isListed && x.publishedAt,
    );
    if (!j || !j.publishedAt) return null;
    return {
      url: j.jobUrl,
      title: j.title,
      company: company ?? orgToCompany(org),
      location: j.location || j.workplaceType || "",
      description: j.descriptionPlain ?? null,
      source: "ashby",
      postedAt: new Date(j.publishedAt).toISOString(),
      snapshotUrl: null,
    };
  } catch {
    return null;
  }
}

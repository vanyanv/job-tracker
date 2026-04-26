import pLimit from "p-limit";
import { LEVER_ORGS, orgToCompany } from "../orgs.js";
import type { JobRecord } from "../types.js";

interface LeverPosting {
  text: string;
  createdAt: number;
  hostedUrl: string;
  categories?: { location?: string; team?: string };
  descriptionPlain?: string;
}

async function fetchOrgLever(org: string): Promise<JobRecord[]> {
  const url = `https://api.lever.co/v0/postings/${org}?mode=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.warn(`[lever] ${org} HTTP ${res.status} — skipping`);
      return [];
    }
    const data = (await res.json()) as LeverPosting[];
    return data
      .filter((p) => p.createdAt && p.createdAt > 0)
      .map((p): JobRecord => ({
        url: p.hostedUrl,
        title: p.text,
        company: orgToCompany(org),
        location: p.categories?.location ?? "",
        description: p.descriptionPlain ?? null,
        source: "lever",
        postedAt: new Date(p.createdAt).toISOString(),
        snapshotUrl: null,
      }));
  } catch (err) {
    console.warn(`[lever] ${org} error: ${String(err)}`);
    return [];
  }
}

export async function scrapeLever(): Promise<JobRecord[]> {
  const limit = pLimit(5);
  const results = await Promise.all(
    LEVER_ORGS.map((org) => limit(() => fetchOrgLever(org))),
  );
  return results.flat();
}

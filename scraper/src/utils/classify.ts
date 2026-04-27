export type AtsKind = "ashby" | "greenhouse" | "lever";
export interface Classified { ats: AtsKind; org: string; jobId: string; }

export function classifyUrl(raw: string): Classified | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);

  if (host === "jobs.ashbyhq.com" && parts.length >= 2) {
    return { ats: "ashby", org: parts[0], jobId: parts[1] };
  }
  if (host === "boards.greenhouse.io" && parts.length >= 3 && parts[1] === "jobs") {
    return { ats: "greenhouse", org: parts[0], jobId: parts[2] };
  }
  if (host === "jobs.lever.co" && parts.length >= 2) {
    return { ats: "lever", org: parts[0], jobId: parts[1] };
  }
  return null;
}

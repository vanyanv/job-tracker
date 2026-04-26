import type { JobRecord } from "../types.js";

export interface FilterOptions {
  hoursWindow: number;
}

export const LOCATION_PATTERNS: RegExp[] = [
  /\bremote\b/i,
  /\b(?:us|usa)\b/i,
  /united\s+states/i,
  /north\s+america/i,
  /new\s+york/i,
  /\bnyc\b/i,
  /san\s+francisco/i,
  /\bsf\b/i,
  /bay\s+area/i,
  /\baustin\b/i,
  /\bseattle\b/i,
  /\bboston\b/i,
  /\bchicago\b/i,
  /\bdenver\b/i,
  /\batlanta\b/i,
  /los\s+angeles/i,
];

export const TITLE_PATTERNS: RegExp[] = [
  /software\s+engineer/i,
  /\bbackend\b/i,
  /\bfrontend\b/i,
  /front[\s-]?end/i,
  /full[\s-]?stack/i,
  /\bsre\b/i,
  /site\s+reliability/i,
  /\bdevops\b/i,
  /platform\s+engineer/i,
  /\bml\s+engineer\b/i,
  /machine\s+learning\s+engineer/i,
  /data\s+engineer/i,
  /infrastructure\s+engineer/i,
];

export function filterJobs(jobs: JobRecord[], opts: FilterOptions): JobRecord[] {
  const cutoff = Date.now() - opts.hoursWindow * 3_600_000;
  return jobs.filter((job) => {
    const ts = new Date(job.postedAt).getTime();
    if (isNaN(ts) || ts < cutoff) return false;
    if (!LOCATION_PATTERNS.some((p) => p.test(job.location))) return false;
    if (!TITLE_PATTERNS.some((p) => p.test(job.title))) return false;
    return true;
  });
}

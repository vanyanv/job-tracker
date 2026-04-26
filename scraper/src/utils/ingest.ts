import type { JobRecord } from "../types.js";

const BATCH_SIZE = 200;

export interface IngestResult {
  sent: number;
  errors: number;
}

async function postBatch(
  chunk: JobRecord[],
  baseUrl: string,
  token: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl}/api/jobs/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ jobs: chunk }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "(unreadable)");
      console.error(`[ingest] HTTP ${res.status}: ${body}`);
      return false;
    }
    const data = (await res.json()) as { jobsReceived?: number };
    console.log(`[ingest] batch ok — jobsReceived=${data.jobsReceived ?? "?"}`);
    return true;
  } catch (err) {
    console.error(`[ingest] network error: ${String(err)}`);
    return false;
  }
}

export async function ingestJobs(jobs: JobRecord[]): Promise<IngestResult> {
  if (jobs.length === 0) return { sent: 0, errors: 0 };

  const baseUrl = process.env.VERCEL_URL!.replace(/\/$/, "");
  const token = process.env.INGEST_BEARER_TOKEN!;

  let sent = 0;
  let errors = 0;

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const chunk = jobs.slice(i, i + BATCH_SIZE);
    const ok = await postBatch(chunk, baseUrl, token);
    if (ok) sent += chunk.length;
    else errors += 1;
  }

  return { sent, errors };
}

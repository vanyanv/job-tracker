import { createHash } from "node:crypto";
import { chromium } from "playwright";
import { put } from "@vercel/blob";
import pLimit from "p-limit";
import type { JobRecord } from "../types.js";

function hash16(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export async function snapshotJobs(jobs: JobRecord[]): Promise<JobRecord[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.warn("[snapshot] BLOB_READ_WRITE_TOKEN not set — skipping snapshot pass");
    return jobs;
  }
  if (jobs.length === 0) return jobs;

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const limit = pLimit(3);

  try {
    await Promise.all(
      jobs.map((job) =>
        limit(async () => {
          const context = await browser.newContext();
          try {
            const page = await context.newPage();
            await page.goto(job.url, {
              timeout: 15_000,
              waitUntil: "domcontentloaded",
            });
            await page
              .waitForLoadState("networkidle", { timeout: 5_000 })
              .catch(() => {});
            const pdf = await page.pdf({
              format: "A4",
              printBackground: true,
            });
            const pathname = `snapshots/${job.source}/${hash16(job.url)}.pdf`;
            const result = await put(pathname, pdf, {
              access: "public",
              contentType: "application/pdf",
              allowOverwrite: true,
              token,
            });
            job.snapshotUrl = result.url;
            console.log(`[snapshot] ${job.url} → ${result.url}`);
          } catch (err) {
            console.warn(`[snapshot] WARN ${job.url} failed: ${String(err)}`);
          } finally {
            await context.close().catch(() => {});
          }
        }),
      ),
    );
  } finally {
    await browser.close();
  }

  return jobs;
}

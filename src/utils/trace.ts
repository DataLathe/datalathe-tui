import type { IngestJob } from "@datalathe/client";

/** The jobs a request started, newest first. */
export function jobsForCorrelation(jobs: IngestJob[], correlationId: string): IngestJob[] {
  return jobs
    .filter((j) => j.correlationId === correlationId)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export function jobProgress(job: IngestJob): string {
  const parts: string[] = [];
  if (job.rowsIngested != null) parts.push(`${job.rowsIngested.toLocaleString()} rows`);
  if (job.chunksTotal != null) parts.push(`${job.chunksDone ?? 0}/${job.chunksTotal} chunks`);
  return parts.join(" · ");
}

export function jobWhen(job: IngestJob): string {
  const stamp = job.updatedAt ?? job.createdAt;
  return stamp == null ? "" : new Date(stamp * 1000).toLocaleString();
}

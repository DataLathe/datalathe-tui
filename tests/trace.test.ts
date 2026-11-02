import { describe, it, expect } from "vitest";
import type { IngestJob } from "@datalathe/client";
import { jobsForCorrelation, jobProgress } from "../src/utils/trace.js";

function job(partial: Partial<IngestJob> & { jobId: string }): IngestJob {
  return { status: "succeeded", ...partial };
}

describe("jobsForCorrelation", () => {
  it("keeps only the run's jobs, newest first", () => {
    const jobs = [
      job({ jobId: "a", correlationId: "run-1", createdAt: 10 }),
      job({ jobId: "b", correlationId: "run-2", createdAt: 20 }),
      job({ jobId: "c", correlationId: "run-1", createdAt: 30 }),
      job({ jobId: "d", correlationId: null }),
    ];
    expect(jobsForCorrelation(jobs, "run-1").map((j) => j.jobId)).toEqual(["c", "a"]);
  });

  it("returns nothing for an unknown id", () => {
    expect(jobsForCorrelation([job({ jobId: "a", correlationId: "x" })], "y")).toEqual([]);
  });
});

describe("jobProgress", () => {
  it("shows rows and chunks when present", () => {
    expect(jobProgress(job({ jobId: "a", rowsIngested: 1200, chunksDone: 2, chunksTotal: 4 }))).toBe(
      "1,200 rows · 2/4 chunks",
    );
    expect(jobProgress(job({ jobId: "b" }))).toBe("");
  });
});

import type { NormalizedJob } from "@/src/types/jobs";

function canonical(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function key(job: NormalizedJob): string {
  return `${canonical(job.company)}|${canonical(job.title)}|${canonical(job.location)}`;
}

export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const unique = new Map<string, NormalizedJob>();
  for (const job of jobs) {
    const existing = unique.get(key(job));
    if (!existing || new Date(job.lastVerifiedAt ?? 0) > new Date(existing.lastVerifiedAt ?? 0)) {
      unique.set(key(job), job);
    }
  }
  return [...unique.values()];
}

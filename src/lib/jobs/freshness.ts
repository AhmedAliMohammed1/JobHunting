import type { JobFreshnessStatus, NormalizedJob } from "@/src/types/jobs";

export function classifyFreshness(job: NormalizedJob, now = new Date()): JobFreshnessStatus {
  if (job.status === "REMOVED") return "REMOVED";
  const reference = job.lastVerifiedAt ?? job.lastSeenAt ?? job.postedAt;
  if (!reference) return "UNKNOWN";
  const hours = (now.getTime() - new Date(reference).getTime()) / 3_600_000;
  if (!Number.isFinite(hours)) return "UNKNOWN";
  if (hours <= 24) return "ACTIVE";
  if (hours <= 24 * 14) return "LIKELY_ACTIVE";
  return "EXPIRED";
}

export function withFreshness(job: NormalizedJob, now = new Date()): NormalizedJob {
  const status = classifyFreshness(job, now);
  return {
    ...job,
    status,
    freshnessLabel:
      status === "ACTIVE" && !job.sourceDelayHours
        ? "live"
        : status === "ACTIVE" || status === "LIKELY_ACTIVE"
          ? job.sourceDelayHours ? "cached" : "recently-refreshed"
          : "unknown",
  };
}

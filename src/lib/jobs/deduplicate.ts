import type { JobSourceType, NormalizedJob } from "@/src/types/jobs";

function canonical(value: string | undefined): string {
  return (value ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

export function canonicalJobUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = "";
    const tracking = [/^utm_/i, /^trk$/i, /^tracking/i, /^ref$/i, /^refid$/i, /^lipi$/i, /^midtoken$/i, /^ebp$/i, /^source$/i, /^from$/i];
    for (const key of [...url.searchParams.keys()]) {
      if (tracking.some((pattern) => pattern.test(key))) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return value;
  }
}

function identityKey(job: NormalizedJob): string {
  return `${canonical(job.company)}|${canonical(job.title)}|${canonical(job.location ?? job.city)}`;
}

function sourceQuality(type: JobSourceType | undefined): number {
  switch (type) {
    case "official-api": return 5;
    case "public-ats": return 4;
    case "career-page": return 3;
    case "approved-feed": return 3;
    case "search-discovery": return 2;
    case "mock": return 0;
    default: return 1;
  }
}

function better(left: NormalizedJob, right: NormalizedJob): NormalizedJob {
  const qualityDelta = sourceQuality(left.sourceType) - sourceQuality(right.sourceType);
  if (qualityDelta !== 0) return qualityDelta > 0 ? left : right;
  const leftVerified = Date.parse(left.lastVerifiedAt ?? left.lastSeenAt ?? "") || 0;
  const rightVerified = Date.parse(right.lastVerifiedAt ?? right.lastSeenAt ?? "") || 0;
  if (leftVerified !== rightVerified) return leftVerified > rightVerified ? left : right;
  return (left.description?.length ?? 0) >= (right.description?.length ?? 0) ? left : right;
}

export function deduplicateJobs(jobs: NormalizedJob[]): NormalizedJob[] {
  const unique: NormalizedJob[] = [];
  for (const job of jobs) {
    const url = canonicalJobUrl(job.sourceUrl);
    const identity = identityKey(job);
    const index = unique.findIndex((existing) => canonicalJobUrl(existing.sourceUrl) === url || identityKey(existing) === identity);
    if (index === -1) unique.push(job);
    else unique[index] = better(job, unique[index]);
  }
  return unique;
}

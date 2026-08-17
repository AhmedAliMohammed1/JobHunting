import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedJob } from "@/src/types/jobs";

export function jobFingerprint(job: NormalizedJob) {
  return createHash("sha256")
    .update([job.provider, job.externalId ?? job.id, job.title.toLowerCase(), job.company.toLowerCase()].join(":"))
    .digest("hex");
}

export async function persistNormalizedJob(admin: SupabaseClient, job: NormalizedJob) {
  const canonicalFingerprint = jobFingerprint(job);
  const { data: stored, error: jobError } = await admin.from("jobs").upsert({
    canonical_fingerprint: canonicalFingerprint,
    title: job.title,
    company: job.company,
    company_logo_url: job.companyLogo ?? null,
    location: job.location ?? null,
    country: job.country ?? null,
    workplace_type: job.workplaceType,
    employment_type: job.employmentType ?? null,
    seniority: job.seniority ?? null,
    salary_min: job.salaryMin ?? null,
    salary_max: job.salaryMax ?? null,
    salary_currency: job.salaryCurrency ?? null,
    salary_text: job.salaryText ?? null,
    description: job.description ?? null,
    posted_at: job.postedAt ?? null,
    first_discovered_at: job.firstDiscoveredAt,
    last_seen_at: job.lastSeenAt,
    last_verified_at: job.lastVerifiedAt ?? null,
    status: job.status,
  }, { onConflict: "canonical_fingerprint" }).select("id").single();
  if (jobError || !stored) throw new Error("Could not persist the selected job.");

  const { error: sourceError } = await admin.from("job_sources").upsert({
    job_id: stored.id,
    provider: job.provider,
    external_id: job.externalId ?? job.id,
    source_url: job.sourceUrl,
    application_url: job.applicationUrl ?? null,
    source_type: job.provider === "mock" ? "mock" : "approved-feed",
    source_delay_hours: job.sourceDelayHours ?? null,
    last_seen_at: job.lastSeenAt,
    last_verified_at: job.lastVerifiedAt ?? null,
  }, { onConflict: "provider,source_url" });
  if (sourceError) throw new Error("Could not persist the job source.");

  if (job.skills.length) {
    const { error: skillsError } = await admin.from("job_skills").upsert(
      job.skills.map((skill) => ({ job_id: stored.id, skill })),
      { onConflict: "job_id,skill", ignoreDuplicates: true },
    );
    if (skillsError) throw new Error("Could not persist job skills.");
  }
  return String(stored.id);
}

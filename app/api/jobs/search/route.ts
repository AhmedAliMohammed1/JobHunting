import { NextResponse } from "next/server";
import { expandSearchQuery } from "@/src/lib/ai/query-expansion";
import { getAIProvider } from "@/src/lib/ai/provider";
import { jobMatchesQuery, searchJobs } from "@/src/lib/jobs/search";
import { SEARCH_ENGINE_VERSION } from "@/src/lib/jobs/search-engine-version";
import { interpretSearchQuery, mergeSearchIntent, shouldUseAIQueryExpansion } from "@/src/lib/jobs/query-intent";
import { rankJobs } from "@/src/lib/matching/rank";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { searchRequestSchema, jobSearchSchema } from "@/src/lib/validation/search";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { ZodError } from "zod";
import type { CandidateProfile, CandidateSkill } from "@/src/types/candidate";
import type { JobSearchQuery, NormalizedJob } from "@/src/types/jobs";
import type { MatchResult } from "@/src/types/matching";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Search-Engine-Version": SEARCH_ENGINE_VERSION,
};

async function loadCandidateProfile(userId: string): Promise<CandidateProfile | undefined> {
  const supabase = await createClient();
  const { data } = await supabase!.from("candidate_profiles")
    .select("id,full_name,current_title,location,summary,skills,programming_languages,frameworks,tools,certifications,languages,years_experience,preferred_roles,preferred_countries,preferred_locations,employment_types,workplace_types,manual_fields")
    .eq("user_id", userId).maybeSingle();
  if (!data) return undefined;
  return {
    id: data.id, userId, fullName: data.full_name ?? undefined, currentTitle: data.current_title ?? undefined,
    location: data.location ?? undefined, summary: data.summary ?? undefined,
    skills: Array.isArray(data.skills) ? data.skills.filter((skill): skill is CandidateSkill => Boolean(skill && typeof skill === "object" && "name" in skill)) : [],
    programmingLanguages: data.programming_languages ?? [], frameworks: data.frameworks ?? [], tools: data.tools ?? [],
    certifications: data.certifications ?? [], languages: data.languages ?? [],
    yearsExperience: data.years_experience == null ? undefined : Number(data.years_experience),
    preferredRoles: data.preferred_roles ?? [], preferredCountries: data.preferred_countries ?? [],
    preferredLocations: data.preferred_locations ?? [], employmentTypes: data.employment_types ?? [],
    workplaceTypes: data.workplace_types ?? [], manualFields: data.manual_fields ?? [],
  };
}

function sourceBreakdown(jobs: NormalizedJob[]): Record<string, number> {
  return jobs.reduce<Record<string, number>>((counts, job) => {
    counts[job.provider] = (counts[job.provider] ?? 0) + 1;
    return counts;
  }, {});
}

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const limit = rateLimit(`job-search:${forwarded ?? "anonymous"}`, 20, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many searches. Try again shortly.", engineVersion: SEARCH_ENGINE_VERSION }, { status: 429, headers: privateHeaders });

  try {
    const startedAt = Date.now();
    const input = searchRequestSchema.parse(await request.json());
    const user = await getCurrentUser();
    const profile = user ? await loadCandidateProfile(user.id) : undefined;
    const deterministic = input.query ? interpretSearchQuery(input.query, profile?.preferredRoles ?? []) : {};
    let expanded: Partial<JobSearchQuery> = {};
    if (input.query && shouldUseAIQueryExpansion(input.query, deterministic)) {
      try {
        expanded = await expandSearchQuery(getAIProvider(), input.query, profile?.preferredRoles ?? []);
      } catch {
        expanded = {};
      }
    }
    const query = jobSearchSchema.parse(mergeSearchIntent(deterministic, expanded, input.filters ?? {}));
    const result = await searchJobs(query);
    const warnings: string[] = [];
    let jobs: Array<NormalizedJob & { match?: MatchResult }> = result.jobs;

    if (profile) {
      jobs = rankJobs(profile, result.jobs)
        .filter(({ match }) => query.minimumMatchScore === undefined || match.score >= query.minimumMatchScore)
        .map(({ job, match }) => ({ ...job, match }));
    } else if (query.minimumMatchScore !== undefined) {
      warnings.push("Minimum match requires a completed candidate profile, so that filter was not applied.");
    }

    // Final fail-closed validation immediately before serialization. This intentionally
    // duplicates the aggregate search filter so an upstream/provider regression can
    // never leak an undated or out-of-window job into a date-filtered response.
    jobs = jobs.filter((job) => jobMatchesQuery(job, query));

    if (query.postedWithinHours !== undefined) {
      warnings.push("Date filters are strict: listings without a verifiable posting date are excluded.");
    }

    const finalBreakdown = sourceBreakdown(jobs);

    if (user) {
      const supabase = await createClient();
      await supabase?.from("search_history").insert({
        user_id: user.id,
        query,
        expanded_terms: [...query.roles, ...query.keywords],
        provider_count: result.providers.length,
        result_count: jobs.length,
        duration_ms: Date.now() - startedAt,
      });
    }

    const disclosureBase = result.providers.some((provider) => provider.providerId === "mock")
      ? "Development fixtures — not live listings."
      : result.totalMatches > jobs.length
        ? `${result.totalMatches} unique live listings matched across ${result.providers.length} source pipelines. Showing ${jobs.length} after final ranking and strict filters.`
        : `${jobs.length} unique live listing${jobs.length === 1 ? "" : "s"} matched across ${result.providers.length} source pipeline${result.providers.length === 1 ? "" : "s"}.`;
    const disclosure = `${disclosureBase} · Engine ${SEARCH_ENGINE_VERSION}`;

    return NextResponse.json({
      jobs,
      providers: result.providers.map(({ health }) => health),
      partial: result.partial,
      interpretedQuery: query,
      warnings,
      disclosure,
      totalMatches: jobs.length,
      sourceBreakdown: finalBreakdown,
      engineVersion: SEARCH_ENGINE_VERSION,
    }, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof ZodError ? "Check the search query and filters." : "Search could not be completed.",
      engineVersion: SEARCH_ENGINE_VERSION,
    }, { status: 400, headers: privateHeaders });
  }
}

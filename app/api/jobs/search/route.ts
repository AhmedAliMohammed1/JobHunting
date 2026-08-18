import { NextResponse } from "next/server";
import { getAIProvider } from "@/src/lib/ai/provider";
import {
  assessJobsWithLLM,
  buildLLMSearchQuery,
  createLLMSearchPlan,
  hybridScore,
  type LLMJobAssessment,
  type LLMSearchPlan,
} from "@/src/lib/ai/llm-job-search";
import { jobMatchesQuery, searchJobs } from "@/src/lib/jobs/search";
import { SEARCH_ENGINE_VERSION } from "@/src/lib/jobs/search-engine-version";
import { interpretSearchQuery, mergeSearchIntent } from "@/src/lib/jobs/query-intent";
import { rankJobs } from "@/src/lib/matching/rank";
import { log } from "@/src/lib/observability/logger";
import { rateLimit } from "@/src/lib/security/rate-limit";
import { searchRequestSchema, jobSearchSchema } from "@/src/lib/validation/search";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { ZodError } from "zod";
import type { CandidateProfile, CandidateSkill } from "@/src/types/candidate";
import type { JobSearchQuery, NormalizedJob, ProviderHealth } from "@/src/types/jobs";
import type { MatchResult } from "@/src/types/matching";

export const maxDuration = 180;

type SearchOrigin = "normal" | "llm" | "both";
type SearchJob = NormalizedJob & {
  match?: MatchResult;
  searchOrigin: SearchOrigin;
  hybridScore?: number;
  aiAssessment?: LLMJobAssessment;
};

type LLMFailureCode = "rate_limit" | "timeout" | "structured_output" | "provider_routing" | "network" | "unknown";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Search-Engine-Version": SEARCH_ENGINE_VERSION,
};

function llmFailureCode(error: unknown): LLMFailureCode {
  const message = error instanceof Error ? `${error.name} ${error.message}`.toLowerCase() : "";
  if (/429|rate limit|quota|capacity/.test(message)) return "rate_limit";
  if (/timeout|abort/.test(message)) return "timeout";
  if (/json|schema|structured|parse/.test(message)) return "structured_output";
  if (/provider|model|route|routing|support/.test(message)) return "provider_routing";
  if (/fetch|network|socket|connection/.test(message)) return "network";
  return "unknown";
}

function failureMessage(code: LLMFailureCode | undefined): string {
  switch (code) {
    case "rate_limit": return "free-model capacity or rate limiting";
    case "timeout": return "an AI timeout";
    case "structured_output": return "a structured-output validation problem";
    case "provider_routing": return "temporary AI provider routing";
    case "network": return "a temporary AI network problem";
    default: return "a temporary AI provider problem";
  }
}

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

function richerJob(left: NormalizedJob, right: NormalizedJob): NormalizedJob {
  const quality = (job: NormalizedJob) =>
    (job.postedAt ? 5 : 0)
    + (job.company && !/unknown|not supplied/i.test(job.company) ? 2 : 0)
    + Math.min((job.description ?? "").length, 1600) / 400
    + job.skills.length / 8;
  return quality(right) > quality(left) ? right : left;
}

function mergeSearchResults(normalJobs: NormalizedJob[], llmJobs: NormalizedJob[]): Array<NormalizedJob & { searchOrigin: SearchOrigin }> {
  const byId = new Map<string, NormalizedJob & { searchOrigin: SearchOrigin }>();
  for (const job of normalJobs) byId.set(job.id, { ...job, searchOrigin: "normal" });
  for (const job of llmJobs) {
    const existing = byId.get(job.id);
    if (!existing) {
      byId.set(job.id, { ...job, searchOrigin: "llm" });
      continue;
    }
    byId.set(job.id, { ...richerJob(existing, job), searchOrigin: "both" });
  }
  return [...byId.values()];
}

function hardFilterQuery(query: JobSearchQuery): JobSearchQuery {
  return { ...query, roles: [], keywords: [], limit: 100 };
}

function mergeProviderHealth(normal: ProviderHealth[], llm: ProviderHealth[]): ProviderHealth[] {
  const rows = new Map<string, ProviderHealth>();
  for (const item of [...normal, ...llm]) {
    const existing = rows.get(item.providerId);
    if (!existing) rows.set(item.providerId, item);
    else rows.set(item.providerId, {
      ...existing,
      ok: existing.ok || item.ok,
      latencyMs: Math.max(existing.latencyMs, item.latencyMs),
      jobsReturned: (existing.jobsReturned ?? 0) + (item.jobsReturned ?? 0),
      errorCode: existing.ok || item.ok ? undefined : existing.errorCode ?? item.errorCode,
    });
  }
  return [...rows.values()];
}

function rankWithProfile(profile: CandidateProfile | undefined, jobs: Array<NormalizedJob & { searchOrigin: SearchOrigin }>) {
  if (!profile) return jobs.map((job) => ({ job, match: undefined as MatchResult | undefined }));
  const origin = new Map(jobs.map((job) => [job.id, job.searchOrigin]));
  return rankJobs(profile, jobs).map(({ job, match }) => ({
    job: { ...job, searchOrigin: origin.get(job.id) ?? ("normal" as SearchOrigin) },
    match,
  }));
}

export async function POST(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const limit = rateLimit(`job-search:${forwarded ?? "anonymous"}`, 12, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many searches. Try again shortly." }, { status: 429, headers: privateHeaders });

  try {
    const startedAt = Date.now();
    const input = searchRequestSchema.parse(await request.json());
    const user = await getCurrentUser();
    const profile = user ? await loadCandidateProfile(user.id) : undefined;
    const deterministic = input.query ? interpretSearchQuery(input.query, profile?.preferredRoles ?? []) : {};
    const baseQuery = jobSearchSchema.parse(mergeSearchIntent(deterministic, {}, input.filters ?? {}));
    const strictQuery = hardFilterQuery(baseQuery);
    const provider = getAIProvider();
    const warnings: string[] = [];
    let plannerFailure: LLMFailureCode | undefined;
    let retrievalFailure: LLMFailureCode | undefined;
    let assessmentFailure: LLMFailureCode | undefined;

    const normalPromise = searchJobs(baseQuery);
    const planPromise: Promise<LLMSearchPlan | undefined> = input.query && provider.id !== "not-configured"
      ? createLLMSearchPlan(provider, input.query, baseQuery, profile).catch((error) => {
          plannerFailure = llmFailureCode(error);
          log("warn", "llm_search_plan_failed", {
            category: plannerFailure,
            errorName: error instanceof Error ? error.name : "UnknownError",
          });
          return undefined;
        })
      : Promise.resolve(undefined);

    const [normalResult, plan] = await Promise.all([normalPromise, planPromise]);

    let llmResult: Awaited<ReturnType<typeof searchJobs>> | undefined;
    let llmQuery: JobSearchQuery | undefined;
    if (plan) {
      llmQuery = jobSearchSchema.parse(buildLLMSearchQuery(baseQuery, plan));
      try {
        llmResult = await searchJobs(llmQuery);
      } catch (error) {
        retrievalFailure = llmFailureCode(error);
        log("warn", "llm_search_retrieval_failed", {
          category: retrievalFailure,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        warnings.push("The LLM-expanded retrieval pass was unavailable, so normal search results are shown.");
      }
    } else if (input.query) {
      warnings.push(`The LLM search planner was unavailable because of ${failureMessage(plannerFailure)}; normal search still completed.`);
    }

    const normalJobs = normalResult.jobs.filter((job) => jobMatchesQuery(job, baseQuery));
    const llmJobs = (llmResult?.jobs ?? []).filter((job) => jobMatchesQuery(job, llmQuery ?? baseQuery) && jobMatchesQuery(job, strictQuery));
    const combined = mergeSearchResults(normalJobs, llmJobs).filter((job) => jobMatchesQuery(job, strictQuery));

    const prelim = rankWithProfile(profile, combined);
    const assessmentCandidates = prelim.slice(0, 24).map(({ job }) => job);
    let aiAssessments = new Map<string, LLMJobAssessment>();
    if (plan && assessmentCandidates.length) {
      try {
        aiAssessments = await assessJobsWithLLM(provider, input.query ?? baseQuery.roles.join(" "), plan, assessmentCandidates, profile);
      } catch (error) {
        assessmentFailure = llmFailureCode(error);
        log("warn", "llm_job_assessment_failed", {
          category: assessmentFailure,
          errorName: error instanceof Error ? error.name : "UnknownError",
        });
        warnings.push("LLM semantic reranking timed out or was unavailable; deterministic CV scoring was kept.");
      }
    }

    let jobs: SearchJob[] = prelim.map(({ job, match }) => {
      const aiAssessment = aiAssessments.get(job.id);
      return {
        ...job,
        match,
        aiAssessment,
        hybridScore: hybridScore(job, match, aiAssessment),
      };
    });

    if (profile && baseQuery.minimumMatchScore !== undefined) {
      jobs = jobs.filter((job) => (job.match?.score ?? 0) >= baseQuery.minimumMatchScore!);
    } else if (!profile && baseQuery.minimumMatchScore !== undefined) {
      warnings.push("Minimum CV match requires a completed candidate profile, so that filter was not applied.");
    }

    jobs = jobs.filter((job) => jobMatchesQuery(job, strictQuery));
    jobs.sort((a, b) => (b.hybridScore ?? b.match?.score ?? 0) - (a.hybridScore ?? a.match?.score ?? 0));
    jobs = jobs.slice(0, baseQuery.limit);

    if (baseQuery.postedWithinHours !== undefined) {
      warnings.push("Date filters are strict: undated and out-of-window listings are excluded even if the LLM considers them relevant.");
    }

    const normalIds = new Set(normalJobs.map((job) => job.id));
    const llmIds = new Set(llmJobs.map((job) => job.id));
    const overlap = [...normalIds].filter((id) => llmIds.has(id)).length;
    const finalBreakdown = sourceBreakdown(jobs);
    const normalBreakdown = sourceBreakdown(normalJobs);
    const llmBreakdown = sourceBreakdown(llmJobs);
    const mergedHealth = mergeProviderHealth(
      normalResult.providers.map(({ health }) => health),
      (llmResult?.providers ?? []).map(({ health }) => health),
    );

    if (user) {
      const supabase = await createClient();
      await supabase?.from("search_history").insert({
        user_id: user.id,
        query: baseQuery,
        expanded_terms: [...new Set([...baseQuery.roles, ...baseQuery.keywords, ...(plan?.roles ?? []), ...(plan?.keywords ?? [])])],
        provider_count: mergedHealth.length,
        result_count: jobs.length,
        duration_ms: Date.now() - startedAt,
      });
    }

    const isMock = normalResult.providers.some((result) => result.providerId === "mock");
    const disclosure = isMock
      ? `Development fixtures — not live listings. Normal search found ${normalJobs.length}; LLM search found ${llmJobs.length}. · Engine ${SEARCH_ENGINE_VERSION}`
      : `${jobs.length} unique live listings after strict filters. Normal search found ${normalJobs.length}; LLM search found ${llmJobs.length}; ${overlap} appeared in both. · Engine ${SEARCH_ENGINE_VERSION}`;

    return NextResponse.json({
      jobs,
      providers: mergedHealth,
      partial: normalResult.partial || Boolean(llmResult?.partial),
      interpretedQuery: baseQuery,
      llmQuery,
      llmPlan: plan,
      warnings,
      disclosure,
      totalMatches: jobs.length,
      sourceBreakdown: finalBreakdown,
      searchModes: {
        normal: { count: normalJobs.length, sourceBreakdown: normalBreakdown },
        llm: {
          count: llmJobs.length,
          sourceBreakdown: llmBreakdown,
          available: Boolean(plan && llmResult),
          planner: plan ? "ready" : "unavailable",
          plannerFailure,
          retrievalFailure,
          assessmentFailure,
        },
        overlap,
        combined: jobs.length,
      },
      scoring: {
        formula: "55% deterministic CV fit + 25% LLM semantic fit + 10% freshness + 10% source confidence when both CV and LLM assessment are available",
      },
      engineVersion: SEARCH_ENGINE_VERSION,
    }, { headers: privateHeaders });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof ZodError ? "Check the search query and filters." : "Search could not be completed.",
    }, { status: 400, headers: privateHeaders });
  }
}

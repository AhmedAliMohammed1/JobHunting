import { z } from "zod";
import type { CandidateProfile } from "@/src/types/candidate";
import type { JobSearchQuery, NormalizedJob } from "@/src/types/jobs";
import type { MatchResult } from "@/src/types/matching";
import type { AIProvider } from "./provider";

const planSchema = z.object({
  intentSummary: z.string().max(800),
  roles: z.array(z.string().min(1).max(100)).min(1).max(16),
  keywords: z.array(z.string().min(1).max(100)).max(20),
  searchAngles: z.array(z.string().min(1).max(180)).max(8),
});

const assessmentSchema = z.object({
  assessments: z.array(z.object({
    id: z.string().min(1),
    relevanceScore: z.number().int().min(0).max(100),
    cvFitScore: z.number().int().min(0).max(100),
    confidence: z.number().int().min(0).max(100),
    reasons: z.array(z.string().min(1).max(220)).max(3),
    matchedConcepts: z.array(z.string().min(1).max(100)).max(8),
    concerns: z.array(z.string().min(1).max(180)).max(4),
  })).max(24),
});

export type LLMSearchPlan = z.infer<typeof planSchema>;
export type LLMJobAssessment = z.infer<typeof assessmentSchema>["assessments"][number];

const planJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["intentSummary", "roles", "keywords", "searchAngles"],
  properties: {
    intentSummary: { type: "string", maxLength: 800 },
    roles: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 16 },
    keywords: { type: "array", items: { type: "string" }, maxItems: 20 },
    searchAngles: { type: "array", items: { type: "string" }, maxItems: 8 },
  },
};

const assessmentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["assessments"],
  properties: {
    assessments: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "relevanceScore", "cvFitScore", "confidence", "reasons", "matchedConcepts", "concerns"],
        properties: {
          id: { type: "string" },
          relevanceScore: { type: "integer", minimum: 0, maximum: 100 },
          cvFitScore: { type: "integer", minimum: 0, maximum: 100 },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          reasons: { type: "array", items: { type: "string" }, maxItems: 3 },
          matchedConcepts: { type: "array", items: { type: "string" }, maxItems: 8 },
          concerns: { type: "array", items: { type: "string" }, maxItems: 4 },
        },
      },
    },
  },
};

function unique(values: string[], limit: number): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function profileContext(profile?: CandidateProfile): string {
  if (!profile) return "No candidate profile is available. Optimize for the user's explicit search request only.";
  const skills = unique([
    ...profile.skills.map((skill) => skill.name),
    ...profile.programmingLanguages,
    ...profile.frameworks,
    ...profile.tools,
    ...profile.certifications,
  ], 45);
  return [
    `Current title: ${profile.currentTitle ?? "unknown"}`,
    `Summary: ${(profile.summary ?? "").slice(0, 1500) || "unknown"}`,
    `Candidate skills: ${skills.join(", ") || "unknown"}`,
    `Preferred roles: ${profile.preferredRoles.join(", ") || "not specified"}`,
  ].join("\n");
}

export async function createLLMSearchPlan(
  provider: AIProvider,
  userRequest: string,
  baseQuery: JobSearchQuery,
  profile?: CandidateProfile,
): Promise<LLMSearchPlan> {
  const prompt = `You are the semantic job-search planner for JobHunter AI.

Create a high-recall but precise search expansion for the request below. Think like a strong technical recruiter: include job-title synonyms and adjacent titles that genuinely describe the same work. For example, an embedded-software search may legitimately include firmware, ECU software, AUTOSAR, RTOS, BSP, embedded Linux, validation/test roles when the candidate context supports them.

HARD RULES:
- Do not change or broaden hard filters such as country, location, source/provider, date window, salary, employment type or workplace type. The application enforces those separately.
- Do not invent employers or vacancies.
- Roles and keywords are retrieval terms only.
- Prefer concrete job titles that employers actually publish.
- Keep the plan focused enough to avoid unrelated engineering jobs.

User request: ${userRequest}

Hard-filtered base query:
${JSON.stringify({
  roles: baseQuery.roles,
  keywords: baseQuery.keywords,
  countries: baseQuery.countries,
  locations: baseQuery.locations,
  providers: baseQuery.providers,
  postedWithinHours: baseQuery.postedWithinHours ?? null,
  employmentTypes: baseQuery.employmentTypes,
  workplaceTypes: baseQuery.workplaceTypes,
  experienceLevels: baseQuery.experienceLevels,
})}

Candidate context:
${profileContext(profile)}`;

  const raw = await provider.generateStructured<unknown>(prompt, planJsonSchema, "llm_job_search_plan");
  return planSchema.parse(raw);
}

const LLM_DISCOVERY_SOURCES = [
  "linkedin", "indeed", "stepstone", "xing", "glassdoor",
  "greenhouse", "lever", "ashby", "smartrecruiters", "personio",
  "workday", "sap-successfactors", "career-page",
];

export function buildLLMSearchQuery(base: JobSearchQuery, plan: LLMSearchPlan): JobSearchQuery {
  return {
    ...base,
    roles: unique([...base.roles, ...plan.roles], 24),
    keywords: unique([...base.keywords, ...plan.keywords], 25),
    // When the user did not choose a specific source, the LLM pass is a complementary
    // public-web/ATS search. Official APIs are already covered by the normal pass, so
    // we avoid spending their quotas twice for the same button click.
    providers: base.providers.length ? base.providers : LLM_DISCOVERY_SOURCES,
    limit: Math.min(100, Math.max(base.limit, 60)),
  };
}

function candidatePayload(job: NormalizedJob) {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location ?? job.city ?? job.country ?? null,
    employmentType: job.employmentType ?? null,
    seniority: job.seniority ?? null,
    workplaceType: job.workplaceType,
    postedAt: job.postedAt ?? null,
    skills: job.skills.slice(0, 16),
    description: (job.description ?? job.snippet ?? "").slice(0, 900),
  };
}

export async function assessJobsWithLLM(
  provider: AIProvider,
  userRequest: string,
  plan: LLMSearchPlan,
  jobs: NormalizedJob[],
  profile?: CandidateProfile,
): Promise<Map<string, LLMJobAssessment>> {
  const candidates = jobs.slice(0, 24).map(candidatePayload);
  if (!candidates.length) return new Map();

  const prompt = `Rank and explain these REAL job candidates for the user's search. All candidate facts below came from retrieval. Do not invent or repair missing facts. Never claim a skill, salary, date, seniority, company, location or requirement unless it is present in the supplied candidate object.

Scoring guidance:
- relevanceScore: semantic relevance to the user's requested work, not just keyword overlap.
- cvFitScore: fit to the supplied candidate profile. If no profile is available, set it equal to relevanceScore.
- confidence: confidence in the assessment based on how much useful job detail is available.
- reasons: concise evidence-based reasons.
- concerns: missing/unclear requirements or apparent mismatches only.

User request: ${userRequest}
LLM search intent: ${plan.intentSummary}
Search roles: ${plan.roles.join(", ")}
Search keywords: ${plan.keywords.join(", ")}

Candidate profile:
${profileContext(profile)}

Retrieved candidates:
${JSON.stringify(candidates)}`;

  const raw = await provider.generateStructured<unknown>(prompt, assessmentJsonSchema, "llm_job_assessment");
  const parsed = assessmentSchema.parse(raw);
  const allowed = new Set(candidates.map((candidate) => candidate.id));
  return new Map(parsed.assessments.filter((item) => allowed.has(item.id)).map((item) => [item.id, item]));
}

function freshnessScore(postedAt?: string): number {
  if (!postedAt) return 30;
  const ageHours = Math.max(0, (Date.now() - Date.parse(postedAt)) / 3_600_000);
  if (!Number.isFinite(ageHours)) return 30;
  if (ageHours <= 24) return 100;
  if (ageHours <= 72) return 90;
  if (ageHours <= 168) return 75;
  if (ageHours <= 336) return 55;
  return 35;
}

function sourceConfidence(job: NormalizedJob): number {
  const base = job.sourceType === "official-api" ? 100
    : job.sourceType === "public-ats" ? 95
      : job.sourceType === "career-page" ? 90
        : job.sourceType === "approved-feed" ? 85
          : job.sourceType === "search-discovery" ? 76
            : 60;
  return job.postedAt ? Math.min(100, base + 4) : base;
}

export function hybridScore(job: NormalizedJob, match?: MatchResult, ai?: LLMJobAssessment): number | undefined {
  const freshness = freshnessScore(job.postedAt);
  const confidence = sourceConfidence(job);
  if (match && ai) {
    const llmSemantic = ai.cvFitScore * 0.6 + ai.relevanceScore * 0.4;
    return Math.round(match.score * 0.55 + llmSemantic * 0.25 + freshness * 0.1 + confidence * 0.1);
  }
  if (match) return Math.round(match.score * 0.8 + freshness * 0.1 + confidence * 0.1);
  if (ai) return Math.round(ai.relevanceScore * 0.7 + freshness * 0.15 + confidence * 0.15);
  return undefined;
}

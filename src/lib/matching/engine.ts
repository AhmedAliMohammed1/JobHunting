import { MATCH_BANDS, MATCH_WEIGHTS } from "@/src/config/matching";
import type { CandidateProfile } from "@/src/types/candidate";
import type { NormalizedJob } from "@/src/types/jobs";
import type { MatchBreakdown, MatchResult } from "@/src/types/matching";
import { deriveCandidateSearchRoles } from "./role-inference";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function containsTerm(text: string, value: string): boolean {
  const normalizedText = ` ${normalize(text)} `;
  const term = normalize(value);
  if (!term) return false;
  return normalizedText.includes(` ${term} `) || (term.includes(" ") && normalizedText.includes(term));
}

function overlapScore(wanted: string[], available: string[]): { score: number; matches: string[]; missing: string[] } {
  const availableSet = new Set(available.map(normalize));
  const wantedUnique = unique(wanted);
  if (!wantedUnique.length) return { score: 50, matches: [], missing: [] };
  const matches = wantedUnique.filter((value) => availableSet.has(normalize(value)));
  return { score: Math.round((matches.length / wantedUnique.length) * 100), matches, missing: wantedUnique.filter((value) => !availableSet.has(normalize(value))) };
}

function tokenAffinity(values: string[], target: string): number {
  if (!values.length) return 50;
  const targetTokens = new Set(normalize(target).split(" ").filter((token) => token.length > 1));
  if (!targetTokens.size) return 0;
  let best = 0;
  for (const value of values) {
    const normalizedValue = normalize(value);
    if (!normalizedValue) continue;
    if (normalize(target).includes(normalizedValue)) return 100;
    const tokens = unique(normalizedValue.split(" ").filter((token) => token.length > 1));
    if (!tokens.length) continue;
    const matched = tokens.filter((token) => targetTokens.has(token)).length;
    best = Math.max(best, Math.round((matched / tokens.length) * 100));
  }
  return best;
}

const SUMMARY_STOP_WORDS = new Set([
  "about", "after", "also", "been", "being", "currently", "experience", "experienced", "from", "have", "into", "strong", "their", "there", "these", "this", "with", "working", "years", "engineer", "engineering", "student",
]);

function profileContextScore(profile: CandidateProfile, job: NormalizedJob, targetRoles: string[]) {
  const profileSkills = unique([
    ...profile.skills.map((skill) => skill.name),
    ...profile.programmingLanguages,
    ...profile.frameworks,
    ...profile.tools,
    ...profile.certifications,
  ]);
  const jobText = [job.title, job.description, job.snippet, ...job.skills].filter(Boolean).join(" ");
  const contextualSkillMatches = profileSkills.filter((skill) => containsTerm(jobText, skill));
  const skillDenominator = Math.max(1, Math.min(8, profileSkills.length));
  const skillContext = profileSkills.length ? Math.min(100, Math.round((contextualSkillMatches.length / skillDenominator) * 100)) : 50;
  const roleContext = tokenAffinity(targetRoles, `${job.title} ${job.description ?? ""}`);

  const summaryTokens = unique(normalize(`${profile.currentTitle ?? ""} ${profile.summary ?? ""}`).split(" ")
    .filter((token) => token.length >= 4 && !SUMMARY_STOP_WORDS.has(token)))
    .slice(0, 40);
  const summaryHits = summaryTokens.filter((token) => containsTerm(jobText, token)).length;
  const summaryContext = summaryTokens.length ? Math.min(100, Math.round((summaryHits / Math.min(12, summaryTokens.length)) * 100)) : 50;

  return {
    score: Math.round(roleContext * 0.45 + skillContext * 0.45 + summaryContext * 0.1),
    contextualSkillMatches,
  };
}

function textAffinity(left: string[], right: string): number {
  if (!left.length) return 50;
  const normalizedRight = normalize(right);
  const matches = left.filter((value) => normalizedRight.includes(normalize(value))).length;
  return Math.round((matches / left.length) * 100);
}

function experienceScore(seniority: string | undefined, yearsExperience: number | undefined): number {
  if (!seniority || yearsExperience === undefined) return 50;
  const normalized = normalize(seniority);
  const minimum = normalized.includes("principal") ? 8
    : normalized.includes("staff") || normalized.includes("lead") ? 7
      : normalized.includes("senior") ? 5
        : normalized.includes("mid") ? 2
          : 0;
  if (yearsExperience >= minimum) return 100;
  return Math.max(20, 100 - (minimum - yearsExperience) * 20);
}

function recencyScore(postedAt?: string): number {
  if (!postedAt) return 40;
  const days = Math.max(0, (Date.now() - new Date(postedAt).getTime()) / 86_400_000);
  if (!Number.isFinite(days)) return 40;
  if (days <= 1) return 100;
  if (days <= 3) return 85;
  if (days <= 7) return 70;
  if (days <= 14) return 50;
  return 20;
}

export function scoreJobMatch(profile: CandidateProfile, job: NormalizedJob, semanticSimilarity?: number): MatchResult {
  const profileSkills = unique([
    ...profile.skills.map((skill) => skill.name),
    ...profile.programmingLanguages,
    ...profile.frameworks,
    ...profile.tools,
    ...profile.certifications,
  ]);
  const targetRoles = deriveCandidateSearchRoles(profile);
  const skills = overlapScore(job.skills, profileSkills);
  const context = profileContextScore(profile, job, targetRoles);
  const matchedSkills = unique([...skills.matches, ...context.contextualSkillMatches]);
  const preferredPlaces = [...profile.preferredLocations, ...profile.preferredCountries];
  const breakdown: MatchBreakdown = {
    semantic: semanticSimilarity === undefined ? context.score : Math.round(Math.max(0, Math.min(1, semanticSimilarity)) * 100),
    skills: job.skills.length ? skills.score : context.contextualSkillMatches.length ? Math.min(100, 50 + context.contextualSkillMatches.length * 10) : 50,
    title: tokenAffinity(targetRoles, job.title),
    experience: experienceScore(job.seniority, profile.yearsExperience),
    location: preferredPlaces.length ? textAffinity(preferredPlaces, `${job.location ?? ""} ${job.country ?? ""}`) : 50,
    employment: profile.employmentTypes.length ? textAffinity(profile.employmentTypes, job.employmentType ?? "") : 50,
    workplace: profile.workplaceTypes.length ? textAffinity(profile.workplaceTypes, job.workplaceType) : 50,
    recency: recencyScore(job.postedAt),
  };
  const score = Math.round(Object.entries(MATCH_WEIGHTS).reduce((total, [key, weight]) => total + breakdown[key as keyof MatchBreakdown] * weight, 0));
  const band = MATCH_BANDS.find((item) => score >= item.minimum)?.label ?? "Low Match";
  const reasons = [
    breakdown.semantic >= 70 ? "Job content strongly aligns with your CV" : breakdown.semantic >= 50 ? "Job content has useful CV overlap" : "Limited CV context overlap",
    matchedSkills.length ? `${matchedSkills.length} CV skill${matchedSkills.length === 1 ? "" : "s"} found in the role` : "No clear CV skill match found in the listing",
    breakdown.title >= 70 ? "Role title aligns with your target profile" : "Role title is adjacent to your profile",
    preferredPlaces.length ? (breakdown.location >= 70 ? "Location preference aligns" : "Location fit needs review") : undefined,
    breakdown.recency >= 85 ? "Recently posted" : undefined,
  ].filter((reason): reason is string => Boolean(reason)).slice(0, 4);
  return { score, band, breakdown, matchedSkills, missingSkills: skills.missing, reasons };
}

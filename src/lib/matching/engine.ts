import { MATCH_BANDS, MATCH_WEIGHTS } from "@/src/config/matching";
import type { CandidateProfile } from "@/src/types/candidate";
import type { NormalizedJob } from "@/src/types/jobs";
import type { MatchBreakdown, MatchResult } from "@/src/types/matching";

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function overlapScore(wanted: string[], available: string[]): { score: number; matches: string[]; missing: string[] } {
  const availableSet = new Set(available.map(normalize));
  const wantedUnique = [...new Set(wanted.map((value) => value.trim()).filter(Boolean))];
  if (!wantedUnique.length) return { score: 50, matches: [], missing: [] };
  const matches = wantedUnique.filter((value) => availableSet.has(normalize(value)));
  return { score: Math.round((matches.length / wantedUnique.length) * 100), matches, missing: wantedUnique.filter((value) => !availableSet.has(normalize(value))) };
}

function textAffinity(left: string[], right: string): number {
  if (!left.length) return 50;
  const normalizedRight = normalize(right);
  const matches = left.filter((value) => normalizedRight.includes(normalize(value))).length;
  return Math.round((matches / left.length) * 100);
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
  const profileSkills = [
    ...profile.skills.map((skill) => skill.name),
    ...profile.programmingLanguages,
    ...profile.frameworks,
    ...profile.tools,
  ];
  const skills = overlapScore(job.skills, profileSkills);
  const preferredPlaces = [...profile.preferredLocations, ...profile.preferredCountries];
  const breakdown: MatchBreakdown = {
    semantic: semanticSimilarity === undefined ? 50 : Math.round(Math.max(0, Math.min(1, semanticSimilarity)) * 100),
    skills: skills.score,
    title: textAffinity(profile.preferredRoles, job.title),
    experience: job.seniority && profile.yearsExperience !== undefined ? 75 : 50,
    location: preferredPlaces.length ? textAffinity(preferredPlaces, `${job.location ?? ""} ${job.country ?? ""}`) : 50,
    employment: profile.employmentTypes.length ? textAffinity(profile.employmentTypes, job.employmentType ?? "") : 50,
    workplace: profile.workplaceTypes.length ? textAffinity(profile.workplaceTypes, job.workplaceType) : 50,
    recency: recencyScore(job.postedAt),
  };
  const score = Math.round(Object.entries(MATCH_WEIGHTS).reduce((total, [key, weight]) => total + breakdown[key as keyof MatchBreakdown] * weight, 0));
  const band = MATCH_BANDS.find((item) => score >= item.minimum)?.label ?? "Low Match";
  const reasons = [
    skills.matches.length ? `${skills.matches.length} matching skill${skills.matches.length === 1 ? "" : "s"}` : "No exact skill overlap yet",
    breakdown.title >= 70 ? "Role aligns with your target titles" : "Role title is adjacent to your targets",
    breakdown.location >= 70 ? "Location preference aligns" : "Location fit needs review",
  ];
  return { score, band, breakdown, matchedSkills: skills.matches, missingSkills: skills.missing, reasons };
}

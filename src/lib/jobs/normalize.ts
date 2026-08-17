import { createHash } from "node:crypto";
import type { JobFreshnessStatus, JobSourceType, NormalizedJob, WorkplaceType } from "@/src/types/jobs";

export function stableJobId(provider: string, externalId: string): string {
  return createHash("sha256").update(`${provider}:${externalId}`).digest("hex").slice(0, 32);
}

export function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return clean || undefined;
}

export function inferWorkplaceType(...values: Array<string | undefined>): WorkplaceType {
  for (const value of values) {
    const text = value?.toLowerCase() ?? "";
    if (/\bhybrid\b/.test(text)) return "hybrid";
    if (/\bremote\b|work from home|distributed|homeoffice/.test(text)) return "remote";
    if (/\bon[ -]?site\b|in office|vor ort/.test(text)) return "onsite";
  }
  return "unknown";
}

export function inferSkills(text: string | undefined): string[] {
  if (!text) return [];
  const known = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python", "Java",
    "C#", ".NET", "Go", "Rust", "C++", "AWS", "Azure", "GCP", "Docker", "Kubernetes",
    "PostgreSQL", "SQL", "GraphQL", "REST", "Terraform", "Figma", "Git",
    "Machine Learning", "AI", "LLM", "NLP", "PyTorch", "TensorFlow", "Computer Vision",
  ];
  return known.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

export function inferSeniority(...values: Array<string | undefined>): string | undefined {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\b(?:intern|internship|praktikum)\b/.test(text)) return "Internship";
  if (/\bworking[ -]?student\b|\bwerkstudent/.test(text)) return "Working student";
  if (/\b(?:entry[ -]?level|graduate|new grad|junior)\b/.test(text)) return "Junior";
  if (/\b(?:principal|staff)\b/.test(text)) return /\bprincipal\b/.test(text) ? "Principal" : "Staff";
  if (/\b(?:lead|head of)\b/.test(text)) return "Lead";
  if (/\bsenior\b|\bsr\.?\b/.test(text)) return "Senior";
  if (/\bmid[ -]?level\b/.test(text)) return "Mid level";
  return undefined;
}

function sourceTypeFor(provider: string): JobSourceType {
  if (provider === "mock") return "mock";
  if (["adzuna", "jooble"].includes(provider)) return "official-api";
  if (["arbeitnow", "remote-ok", "remotive"].includes(provider)) return "approved-feed";
  if (provider === "ats-registry") return "public-ats";
  return "career-page";
}

export function normalizedJob(input: {
  provider: string;
  sourceType?: JobSourceType;
  externalId: string;
  title: string;
  company: string;
  sourceUrl: string;
  applicationUrl?: string;
  location?: string;
  country?: string;
  city?: string;
  description?: string;
  snippet?: string;
  employmentType?: string;
  salaryText?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  postedAt?: string;
  companyLogo?: string;
  skills?: string[];
  seniority?: string;
  workplaceType?: WorkplaceType;
  sourceDelayHours?: number;
  status?: JobFreshnessStatus;
}): NormalizedJob {
  const now = new Date().toISOString();
  const description = cleanText(input.description);
  return {
    id: stableJobId(input.provider, input.externalId),
    externalId: input.externalId,
    provider: input.provider,
    sourceType: input.sourceType ?? sourceTypeFor(input.provider),
    title: cleanText(input.title) ?? "Untitled role",
    company: cleanText(input.company) ?? "Unknown company",
    companyLogo: input.companyLogo,
    location: cleanText(input.location),
    country: cleanText(input.country),
    city: cleanText(input.city),
    workplaceType: input.workplaceType ?? inferWorkplaceType(input.location, description),
    employmentType: cleanText(input.employmentType),
    seniority: cleanText(input.seniority) ?? inferSeniority(input.title, description),
    salaryText: cleanText(input.salaryText),
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    salaryCurrency: cleanText(input.salaryCurrency),
    description,
    snippet: cleanText(input.snippet) ?? description?.slice(0, 320),
    skills: [...new Set([...inferSkills(description), ...(input.skills ?? []).map((skill) => cleanText(skill)).filter((skill): skill is string => Boolean(skill))])],
    postedAt: input.postedAt,
    firstDiscoveredAt: now,
    lastSeenAt: now,
    lastVerifiedAt: now,
    applicationUrl: input.applicationUrl,
    sourceUrl: input.sourceUrl,
    status: input.status ?? "LIKELY_ACTIVE",
    freshnessLabel: input.sourceDelayHours ? "cached" : "recently-refreshed",
    sourceDelayHours: input.sourceDelayHours,
  };
}

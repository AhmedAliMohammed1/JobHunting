import { createHash } from "node:crypto";
import type { JobFreshnessStatus, NormalizedJob, WorkplaceType } from "@/src/types/jobs";

export function stableJobId(provider: string, externalId: string): string {
  return createHash("sha256").update(`${provider}:${externalId}`).digest("hex").slice(0, 32);
}

export function cleanText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return clean || undefined;
}

export function inferWorkplaceType(...values: Array<string | undefined>): WorkplaceType {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (/\bremote\b|work from home|distributed/.test(text)) return "remote";
  if (/\bhybrid\b/.test(text)) return "hybrid";
  if (/\bon[ -]?site\b|in office/.test(text)) return "onsite";
  return "unknown";
}

export function inferSkills(text: string | undefined): string[] {
  if (!text) return [];
  const known = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python", "Java",
    "C#", ".NET", "Go", "Rust", "AWS", "Azure", "GCP", "Docker", "Kubernetes",
    "PostgreSQL", "SQL", "GraphQL", "REST", "Terraform", "Figma", "Git",
  ];
  return known.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

export function normalizedJob(input: {
  provider: string;
  externalId: string;
  title: string;
  company: string;
  sourceUrl: string;
  applicationUrl?: string;
  location?: string;
  country?: string;
  description?: string;
  employmentType?: string;
  salaryText?: string;
  postedAt?: string;
  companyLogo?: string;
  sourceDelayHours?: number;
  status?: JobFreshnessStatus;
}): NormalizedJob {
  const now = new Date().toISOString();
  const description = cleanText(input.description);
  return {
    id: stableJobId(input.provider, input.externalId),
    externalId: input.externalId,
    provider: input.provider,
    title: cleanText(input.title) ?? "Untitled role",
    company: cleanText(input.company) ?? "Unknown company",
    companyLogo: input.companyLogo,
    location: cleanText(input.location),
    country: cleanText(input.country),
    workplaceType: inferWorkplaceType(input.location, description),
    employmentType: cleanText(input.employmentType),
    salaryText: cleanText(input.salaryText),
    description,
    skills: inferSkills(description),
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

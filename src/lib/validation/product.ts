import { z } from "zod";
import { jobSearchSchema } from "./search";

const shortText = z.string().trim().max(200);
const textList = z.array(shortText.min(1)).max(100);
const httpsUrl = z.string().url().refine((value) => value.toLowerCase().startsWith("https://"), "Use an HTTPS URL.");

export const candidateProfileInputSchema = z.object({
  fullName: shortText.optional(),
  currentTitle: shortText.optional(),
  location: shortText.optional(),
  summary: z.string().trim().max(4_000).optional(),
  skills: textList,
  preferredRoles: textList,
  preferredCountries: textList,
  preferredLocations: textList,
  employmentTypes: textList,
  workplaceTypes: z.array(z.enum(["remote", "hybrid", "onsite"])).max(3),
  yearsExperience: z.number().min(0).max(80).nullable(),
});

export const normalizedJobInputSchema = z.object({
  id: z.string().min(1).max(100),
  externalId: z.string().max(300).optional(),
  provider: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(500),
  company: z.string().trim().min(1).max(500),
  companyLogo: httpsUrl.optional(),
  location: z.string().max(500).optional(),
  country: z.string().max(200).optional(),
  workplaceType: z.enum(["remote", "hybrid", "onsite", "unknown"]),
  employmentType: z.string().max(200).optional(),
  seniority: z.string().max(200).optional(),
  salaryMin: z.number().nonnegative().optional(),
  salaryMax: z.number().nonnegative().optional(),
  salaryCurrency: z.string().length(3).optional(),
  salaryText: z.string().max(500).optional(),
  description: z.string().max(100_000).optional(),
  skills: textList,
  postedAt: z.string().datetime().optional(),
  firstDiscoveredAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  lastVerifiedAt: z.string().datetime().optional(),
  applicationUrl: httpsUrl.optional(),
  sourceUrl: httpsUrl,
  status: z.enum(["ACTIVE", "LIKELY_ACTIVE", "EXPIRED", "REMOVED", "UNKNOWN"]),
  freshnessLabel: z.enum(["live", "recently-refreshed", "cached", "unknown"]),
  sourceDelayHours: z.number().nonnegative().optional(),
}).refine((job) => job.salaryMin === undefined || job.salaryMax === undefined || job.salaryMax >= job.salaryMin, {
  message: "Maximum salary must be at least the minimum salary.",
  path: ["salaryMax"],
});

export const saveJobInputSchema = z.object({
  job: normalizedJobInputSchema,
  priority: z.number().int().min(0).max(3).default(0),
  notes: z.string().trim().max(4_000).optional(),
});

export const savedSearchInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  query: jobSearchSchema,
  enabled: z.boolean().default(true),
  schedule: z.enum(["immediate", "hourly", "daily"]).default("daily"),
  minimumMatchScore: z.number().int().min(0).max(100).default(75),
});

export const applicationCreateSchema = z.object({
  jobId: z.string().uuid(),
  applicationUrl: httpsUrl.optional(),
});

export const applicationUpdateSchema = z.object({
  stage: z.enum(["Saved", "Planning", "Applying", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"]),
});

export const automationSettingsInputSchema = z.object({
  enabled: z.boolean(),
  minimumMatch: z.number().int().min(0).max(100),
  dailyLimit: z.number().int().min(1).max(25),
  weeklyLimit: z.number().int().min(1).max(100),
  companyDailyLimit: z.number().int().min(1).max(5),
  maximumJobAgeHours: z.number().int().min(1).max(720),
  companyWhitelist: textList,
  companyBlacklist: textList,
});

export const idSchema = z.string().uuid();

export function splitList(value: string) {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

import { z } from "zod";

const stringList = z.array(z.string().trim().min(1).max(100)).max(25).default([]);

export const jobSearchSchema = z.object({
  keywords: stringList,
  roles: stringList,
  locations: stringList,
  countries: stringList,
  employmentTypes: stringList,
  workplaceTypes: z
    .array(z.enum(["remote", "hybrid", "onsite", "unknown"]))
    .max(4)
    .default([]),
  experienceLevels: stringList,
  companies: stringList,
  excludedCompanies: stringList,
  providers: stringList,
  postedWithinHours: z.number().int().positive().max(24 * 365).optional(),
  minimumSalary: z.number().nonnegative().optional(),
  minimumMatchScore: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  cursor: z.string().max(500).optional(),
});

const optionalStringList = z.array(z.string().trim().min(1).max(100)).max(25).optional();

export const jobSearchFiltersSchema = z.object({
  keywords: optionalStringList,
  roles: optionalStringList,
  locations: optionalStringList,
  countries: optionalStringList,
  employmentTypes: optionalStringList,
  workplaceTypes: z.array(z.enum(["remote", "hybrid", "onsite", "unknown"])).max(4).optional(),
  experienceLevels: optionalStringList,
  companies: optionalStringList,
  excludedCompanies: optionalStringList,
  providers: optionalStringList,
  postedWithinHours: z.number().int().positive().max(24 * 365).optional(),
  minimumSalary: z.number().nonnegative().optional(),
  minimumMatchScore: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().max(500).optional(),
});

export const searchRequestSchema = z.object({
  query: z.string().trim().max(500).optional(),
  filters: jobSearchFiltersSchema.optional(),
}).refine((input) => Boolean(input.query || (input.filters && Object.keys(input.filters).length)), "A query or filter is required.");

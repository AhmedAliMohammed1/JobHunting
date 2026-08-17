import { z } from "zod";
import type { AIProvider } from "./provider";
import type { JobSearchQuery } from "@/src/types/jobs";

const querySchema = z.object({
  roles: z.array(z.string()).min(1).max(12),
  countries: z.array(z.string()).max(10),
  locations: z.array(z.string()).max(20),
  experience: z.array(z.string()).max(8),
  postedWithinHours: z.number().int().positive().max(2160).nullable(),
});

export async function expandSearchQuery(provider: AIProvider, query: string, candidateRoles: string[]) {
  const schema = {
    type: "object", additionalProperties: false,
    required: ["roles", "countries", "locations", "experience", "postedWithinHours"],
    properties: {
      roles: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 12 }, countries: { type: "array", items: { type: "string" } },
      locations: { type: "array", items: { type: "string" } }, experience: { type: "array", items: { type: "string" } },
      postedWithinHours: { type: ["integer", "null"] },
    },
  };
  const raw = await provider.generateStructured<unknown>(`Interpret this job search request. Expand roles conservatively using the candidate's target roles.\nTargets: ${candidateRoles.join(", ")}\nRequest: ${query}`, schema, "job_search_query");
  const parsed = querySchema.parse(raw);
  return {
    roles: parsed.roles,
    countries: parsed.countries,
    locations: parsed.locations,
    experienceLevels: parsed.experience,
    postedWithinHours: parsed.postedWithinHours ?? undefined,
  } satisfies Partial<JobSearchQuery>;
}

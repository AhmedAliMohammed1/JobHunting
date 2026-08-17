import { z } from "zod";
import type { AIProvider } from "./provider";

export const jobRequirementsSchema = z.object({
  requiredSkills: z.array(z.string()).max(100),
  preferredSkills: z.array(z.string()).max(100),
  minimumYearsExperience: z.number().nonnegative().nullable(),
  languages: z.array(z.string()).max(30),
  seniority: z.string().nullable(),
});

export async function parseJobRequirements(provider: AIProvider, description: string) {
  const schema = {
    type: "object", additionalProperties: false,
    required: ["requiredSkills", "preferredSkills", "minimumYearsExperience", "languages", "seniority"],
    properties: {
      requiredSkills: { type: "array", items: { type: "string" } }, preferredSkills: { type: "array", items: { type: "string" } },
      minimumYearsExperience: { type: ["number", "null"] }, languages: { type: "array", items: { type: "string" } }, seniority: { type: ["string", "null"] },
    },
  };
  const result = await provider.generateStructured<unknown>(`Extract explicit job requirements. Keep unknown values null.\n\n${description.slice(0, 60_000)}`, schema, "job_requirements");
  return jobRequirementsSchema.parse(result);
}


import { z } from "zod";
import type { AIProvider } from "./provider";

export const candidateProfileSchema = z.object({
  fullName: z.string().min(1).nullable(),
  currentTitle: z.string().min(1).nullable(),
  location: z.string().min(1).nullable(),
  skills: z.array(z.string().min(1)).max(100),
  programmingLanguages: z.array(z.string().min(1)).max(50),
  frameworks: z.array(z.string().min(1)).max(50),
  tools: z.array(z.string().min(1)).max(100),
  education: z.array(z.object({ institution: z.string(), degree: z.string().nullable(), field: z.string().nullable() })).max(20),
  employment: z.array(z.object({ company: z.string(), position: z.string(), startDate: z.string().nullable(), endDate: z.string().nullable() })).max(30),
  projects: z.array(z.string()).max(30),
  certifications: z.array(z.string()).max(30),
  languages: z.array(z.object({ name: z.string(), level: z.string().nullable() })).max(30),
  yearsExperience: z.number().nonnegative().nullable(),
});

const jsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fullName", "currentTitle", "location", "skills", "programmingLanguages", "frameworks", "tools", "education", "employment", "projects", "certifications", "languages", "yearsExperience"],
  properties: {
    fullName: { type: ["string", "null"] }, currentTitle: { type: ["string", "null"] }, location: { type: ["string", "null"] },
    skills: { type: "array", items: { type: "string" } }, programmingLanguages: { type: "array", items: { type: "string" } },
    frameworks: { type: "array", items: { type: "string" } }, tools: { type: "array", items: { type: "string" } },
    education: { type: "array", items: { type: "object", additionalProperties: false, required: ["institution", "degree", "field"], properties: { institution: { type: "string" }, degree: { type: ["string", "null"] }, field: { type: ["string", "null"] } } } },
    employment: { type: "array", items: { type: "object", additionalProperties: false, required: ["company", "position", "startDate", "endDate"], properties: { company: { type: "string" }, position: { type: "string" }, startDate: { type: ["string", "null"] }, endDate: { type: ["string", "null"] } } } },
    projects: { type: "array", items: { type: "string" } }, certifications: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "level"], properties: { name: { type: "string" }, level: { type: ["string", "null"] } } } },
    yearsExperience: { type: ["number", "null"] },
  },
};

export async function parseCandidateText(provider: AIProvider, cvText: string) {
  if (cvText.length > 120_000) throw new Error("CV text exceeds the safe parsing limit.");
  const result = await provider.generateStructured<unknown>(
    `Extract only facts explicitly present in this CV. Do not infer visa, nationality, salary, legal, demographic, or work-authorization data.\n\nCV:\n${cvText}`,
    jsonSchema,
    "candidate_profile",
  );
  return candidateProfileSchema.parse(result);
}

export function mergeAuthoritativeProfile<T extends Record<string, unknown>>(existing: T, extracted: Partial<T>, manualFields: string[]): T {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(extracted)) {
    if (!manualFields.includes(key) && value !== undefined) merged[key as keyof T] = value as T[keyof T];
  }
  return merged;
}


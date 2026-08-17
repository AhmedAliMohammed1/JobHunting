import { z } from "zod";
import type { AIProvider } from "./provider";

const coverLetterSchema = z.object({ coverLetter: z.string().min(100).max(5000), usedFacts: z.array(z.string()).max(30) });

export async function generateCoverLetter(provider: AIProvider, profileFacts: string[], jobFacts: string[]) {
  const schema = { type: "object", additionalProperties: false, required: ["coverLetter", "usedFacts"], properties: { coverLetter: { type: "string" }, usedFacts: { type: "array", items: { type: "string" } } } };
  const raw = await provider.generateStructured<unknown>(`Write a concise professional cover letter using only the supplied facts. Do not invent facts.\nCandidate facts:\n- ${profileFacts.join("\n- ")}\nJob facts:\n- ${jobFacts.join("\n- ")}`, schema, "cover_letter");
  const parsed = coverLetterSchema.parse(raw);
  const allowed = new Set(profileFacts.map((fact) => fact.toLowerCase()));
  if (parsed.usedFacts.some((fact) => !allowed.has(fact.toLowerCase()))) throw new Error("Generated cover letter cited an unapproved fact.");
  return parsed.coverLetter;
}


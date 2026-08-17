import type { ApplicationField, AnswerSource } from "@/src/types/applications";

export interface ApprovedFact { key: string; value: string; source: AnswerSource }

const aliases: Record<string, string[]> = {
  fullName: ["full name", "name"], email: ["email", "email address"], phone: ["phone", "telephone", "mobile"],
  location: ["location", "city", "current location"], linkedIn: ["linkedin", "linkedin url"], portfolio: ["portfolio", "website"],
};

export function mapFields(fields: ApplicationField[], facts: ApprovedFact[]): ApplicationField[] {
  const factMap = new Map(facts.map((fact) => [fact.key, fact]));
  return fields.map((field) => {
    const label = field.label.toLowerCase().trim();
    const key = Object.entries(aliases).find(([, names]) => names.includes(label))?.[0];
    const fact = key ? factMap.get(key) : undefined;
    if (!fact) return { ...field, unknown: true, confidence: 0 };
    return { ...field, value: fact.value, source: fact.source, confidence: 1, unknown: false };
  });
}

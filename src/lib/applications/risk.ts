import type { ApplicationField, ApplicationRisk } from "@/src/types/applications";

const sensitive = /salary|compensation|visa|sponsor|work authorization|disability|veteran|gender|race|ethnicity|criminal|demographic|date of birth|nationality/i;

export function classifyFieldRisk(field: Pick<ApplicationField, "label" | "type" | "sensitive">): ApplicationRisk {
  if (field.sensitive || sensitive.test(field.label)) return "HIGH";
  if (field.type === "file" || /notice period|start date|willing to relocate/i.test(field.label)) return "MEDIUM";
  return "LOW";
}

export function requiresUserReview(field: ApplicationField): boolean {
  return classifyFieldRisk(field) === "HIGH" || field.unknown === true || (field.confidence !== undefined && field.confidence < 0.8);
}

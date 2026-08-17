import type { ApplicationField } from "@/src/types/applications";

export function validateField(field: ApplicationField): string[] {
  const issues: string[] = [];
  if (field.required && !field.value) issues.push("Required value is missing.");
  if (field.type === "email" && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) issues.push("Email format is invalid.");
  if (field.type === "phone" && field.value && !/^\+?[\d\s().-]{7,25}$/.test(field.value)) issues.push("Phone format is invalid.");
  if (field.value && field.value.length > 20_000) issues.push("Value is longer than allowed.");
  return issues;
}

export function validateApplication(fields: ApplicationField[]) {
  return fields.map((field) => ({ fieldId: field.id, issues: validateField(field) })).filter((result) => result.issues.length);
}

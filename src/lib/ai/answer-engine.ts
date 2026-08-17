import type { ApplicationField, AnswerSource } from "@/src/types/applications";

const sensitivePattern = /visa|sponsor|work authorization|criminal|legal|disability|demographic|gender|ethnicity|salary|security clearance|nationality|citizen/i;

export interface ApprovedFact {
  question: string;
  answer: string;
  source: Exclude<AnswerSource, "generated">;
}

export function mapApprovedAnswers(fields: ApplicationField[], facts: ApprovedFact[]): ApplicationField[] {
  return fields.map((field) => {
    const sensitive = field.sensitive || sensitivePattern.test(field.label);
    const fact = facts.find((candidate) => candidate.question.toLowerCase() === field.label.toLowerCase());
    if (!fact) return { ...field, sensitive, unknown: true, value: undefined, confidence: 0 };
    return { ...field, sensitive, unknown: false, value: fact.answer, source: fact.source, confidence: 1 };
  });
}

export function mayGenerateFreeText(field: ApplicationField): boolean {
  return !field.sensitive && !sensitivePattern.test(field.label) && ["text", "textarea"].includes(field.type);
}


import type { ApplicationField } from "@/src/types/applications";

export interface RawFormControl {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
}

const supportedTypes = new Set<ApplicationField["type"]>(["text", "email", "phone", "select", "radio", "checkbox", "textarea", "date", "file", "autocomplete"]);

export function analyzeForm(controls: RawFormControl[]): ApplicationField[] {
  return controls.map((control) => ({
    id: control.id,
    label: control.label.trim() || control.id,
    type: supportedTypes.has(control.type as ApplicationField["type"]) ? control.type as ApplicationField["type"] : "text",
    required: Boolean(control.required),
    sensitive: /salary|visa|sponsor|demographic|disability|veteran|gender|race|date of birth/i.test(control.label),
  }));
}

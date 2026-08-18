import type { CandidateProfile } from "@/src/types/candidate";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function deriveCandidateSearchRoles(profile: CandidateProfile): string[] {
  const explicit = unique(profile.preferredRoles);
  if (explicit.length) return explicit.slice(0, 8);

  const profileText = normalize([
    profile.currentTitle,
    profile.summary,
    ...profile.skills.map((skill) => skill.name),
    ...profile.programmingLanguages,
    ...profile.frameworks,
    ...profile.tools,
  ].filter(Boolean).join(" "));

  const roles: string[] = [];
  const add = (...values: string[]) => roles.push(...values);

  if (/software test|test automation|squish|regression test|automated test/.test(profileText)) {
    add("Software Test Engineer", "Test Automation Engineer", "Software Validation Engineer");
  }
  if (/embedded|freertos|\brtos\b|bare metal|stm32|arm cortex|uart|spi|i2c|\bcan\b/.test(profileText)) {
    add("Embedded Software Engineer", "Embedded Systems Engineer");
  }
  if (/automotive|canoe|vehicle|ecu|autosar/.test(profileText)) {
    add("Automotive Software Engineer", "Automotive Test Engineer");
  }
  if (/sensor validation|environmental testing|data acquisition|system validation/.test(profileText)) {
    add("Validation Engineer", "System Test Engineer");
  }
  if (/pcb|altium|cadence allegro|board bring up|hardware debugging/.test(profileText)) {
    add("Hardware Validation Engineer", "Electronics Engineer");
  }
  if (/ros 2|robotics|yolov8|onnx runtime|cuda/.test(profileText)) {
    add("Robotics Software Engineer");
  }

  if (!roles.length && profile.currentTitle && /engineer|developer|scientist|analyst|tester/i.test(profile.currentTitle)) {
    roles.push(profile.currentTitle);
  }
  if (!roles.length) roles.push("Software Engineer");

  return unique(roles).slice(0, 8);
}

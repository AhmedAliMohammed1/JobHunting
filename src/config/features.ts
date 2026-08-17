export const FEATURE_KEYS = [
  "AUTO_APPLY",
  "BROWSER_AUTOMATION",
  "SMART_SEARCH",
  "CV_TAILORING",
  "INTERVIEW_ASSISTANT",
  "EMAIL_ALERTS",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

const defaults: Record<FeatureKey, boolean> = {
  AUTO_APPLY: false,
  BROWSER_AUTOMATION: false,
  SMART_SEARCH: true,
  CV_TAILORING: false,
  INTERVIEW_ASSISTANT: false,
  EMAIL_ALERTS: false,
};

export function isFeatureEnabled(feature: FeatureKey): boolean {
  const value = process.env[`FEATURE_${feature}`];
  if (value === undefined) return defaults[feature];
  return value.toLowerCase() === "true";
}

export const AUTOMATION_LIMITS = Object.freeze({
  defaultDaily: 10,
  maximumDaily: 25,
  defaultWeekly: 50,
  maximumWeekly: 100,
  defaultPerCompanyPerDay: 2,
  maximumPerCompanyPerDay: 5,
});


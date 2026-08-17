import type { ApplicationField, PreflightStatus } from "@/src/types/applications";
import { requiresUserReview } from "./risk";

export interface PreflightResult {
  status: PreflightStatus;
  missingRequired: string[];
  reviewRequired: string[];
  blockers: string[];
}

export function runPreflight(fields: ApplicationField[], conditions: { captcha?: boolean; otp?: boolean; login?: boolean; supported?: boolean } = {}): PreflightResult {
  const missingRequired = fields.filter((field) => field.required && !field.value).map((field) => field.label);
  const reviewRequired = fields.filter(requiresUserReview).map((field) => field.label);
  const blockers = [
    conditions.captcha ? "CAPTCHA requires user interaction." : "",
    conditions.otp ? "One-time passcode requires user interaction." : "",
    conditions.login ? "Authentication requires user interaction." : "",
    conditions.supported === false ? "Application flow is unsupported." : "",
  ].filter(Boolean);
  const status: PreflightStatus = blockers.length ? "BLOCKED" : missingRequired.length || reviewRequired.length ? "ACTION_REQUIRED" : "READY";
  return { status, missingRequired, reviewRequired, blockers };
}

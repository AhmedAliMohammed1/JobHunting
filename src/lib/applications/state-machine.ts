import type { ApplicationState } from "@/src/types/applications";

const transitions: Record<ApplicationState, readonly ApplicationState[]> = {
  DISCOVERED: ["MATCHED", "EXPIRED"],
  MATCHED: ["ELIGIBLE", "BLOCKED", "EXPIRED"],
  ELIGIBLE: ["QUEUED", "WAITING_FOR_USER", "BLOCKED"],
  QUEUED: ["ANALYZING", "FAILED", "EXPIRED"],
  ANALYZING: ["PREPARING", "WAITING_FOR_USER", "CAPTCHA_REQUIRED", "LOGIN_REQUIRED", "UNSUPPORTED", "FAILED"],
  PREPARING: ["READY", "WAITING_FOR_USER", "BLOCKED", "FAILED"],
  WAITING_FOR_USER: ["PREPARING", "READY", "BLOCKED", "EXPIRED"],
  READY: ["SUBMITTING", "BLOCKED", "EXPIRED"],
  SUBMITTING: ["SUBMITTED", "CAPTCHA_REQUIRED", "OTP_REQUIRED", "LOGIN_REQUIRED", "FAILED", "BLOCKED"],
  SUBMITTED: ["CONFIRMED", "FAILED"],
  CONFIRMED: [], FAILED: ["QUEUED"], BLOCKED: [], CAPTCHA_REQUIRED: ["WAITING_FOR_USER"],
  OTP_REQUIRED: ["WAITING_FOR_USER"], LOGIN_REQUIRED: ["WAITING_FOR_USER"], UNSUPPORTED: [], EXPIRED: [],
};

export function canTransition(from: ApplicationState, to: ApplicationState): boolean {
  return transitions[from].includes(to);
}

export function transitionApplication(from: ApplicationState, to: ApplicationState): ApplicationState {
  if (!canTransition(from, to)) throw new Error(`Invalid application transition: ${from} -> ${to}`);
  return to;
}

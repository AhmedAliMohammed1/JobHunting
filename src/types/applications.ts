export type AnswerSource =
  | "user-profile"
  | "cv"
  | "saved-answer"
  | "generated"
  | "user-entered";

export type ApplicationState =
  | "DISCOVERED"
  | "MATCHED"
  | "ELIGIBLE"
  | "QUEUED"
  | "ANALYZING"
  | "PREPARING"
  | "WAITING_FOR_USER"
  | "READY"
  | "SUBMITTING"
  | "SUBMITTED"
  | "CONFIRMED"
  | "FAILED"
  | "BLOCKED"
  | "CAPTCHA_REQUIRED"
  | "OTP_REQUIRED"
  | "LOGIN_REQUIRED"
  | "UNSUPPORTED"
  | "EXPIRED";

export interface ApplicationField {
  id: string;
  label: string;
  type:
    | "text"
    | "email"
    | "phone"
    | "select"
    | "radio"
    | "checkbox"
    | "textarea"
    | "date"
    | "file"
    | "autocomplete";
  required: boolean;
  value?: string;
  source?: AnswerSource;
  confidence?: number;
  sensitive?: boolean;
  unknown?: boolean;
}

export type PreflightStatus = "READY" | "ACTION_REQUIRED" | "BLOCKED";
export type ApplicationRisk = "LOW" | "MEDIUM" | "HIGH";


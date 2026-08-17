export interface WorkerField { id: string; label: string; value?: string; required: boolean; sensitive?: boolean }
export interface WorkerTask { id: string; url: string; dryRun: boolean; fields: WorkerField[]; allowlistedDomains: string[] }
export type WorkerOutcome = "READY" | "WAITING_FOR_USER" | "CAPTCHA_REQUIRED" | "OTP_REQUIRED" | "LOGIN_REQUIRED" | "UNSUPPORTED" | "FAILED";
export interface WorkerResult { taskId: string; outcome: WorkerOutcome; message: string; evidence?: { finalUrl: string; screenshotPath?: string } }

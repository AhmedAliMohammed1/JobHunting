import { runPreflight } from "./preflight";

export function runSafetySimulation() {
  const safe = runPreflight([{ id: "email", label: "Email", type: "email", required: true, value: "candidate@example.com", source: "user-profile" }]);
  const sensitive = runPreflight([{ id: "demographic", label: "Demographic information", type: "select", required: false, value: "answer", sensitive: true }]);
  const captcha = runPreflight([], { captcha: true });
  const missing = runPreflight([{ id: "salary", label: "Salary expectation", type: "text", required: true }]);
  const passed = safe.status === "READY" && sensitive.status === "ACTION_REQUIRED" && captcha.status === "BLOCKED" && missing.status === "ACTION_REQUIRED";
  return { passed, checks: { safeSubmission: safe.status, sensitiveStop: sensitive.status, captchaStop: captcha.status, missingAnswerStop: missing.status } };
}

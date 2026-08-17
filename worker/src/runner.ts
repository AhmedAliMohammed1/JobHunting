import { chromium } from "playwright";
import { assertSafeTask } from "./safety.js";
import type { WorkerResult, WorkerTask } from "./types.js";

export async function runTask(task: WorkerTask): Promise<WorkerResult> {
  const url = assertSafeTask(task);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    const pageText = (await page.locator("body").innerText()).slice(0, 25_000);
    if (/captcha|recaptcha|hcaptcha/i.test(pageText)) return { taskId: task.id, outcome: "CAPTCHA_REQUIRED", message: "CAPTCHA detected; user interaction required." };
    if (/one[- ]time pass(code|word)|verification code|enter.*otp/i.test(pageText)) return { taskId: task.id, outcome: "OTP_REQUIRED", message: "OTP detected; user interaction required." };
    if (/sign in|log in/i.test(pageText) && /password/i.test(pageText)) return { taskId: task.id, outcome: "LOGIN_REQUIRED", message: "Login detected; credentials are never requested or stored by the worker." };
    // The production runner stops before mutation until a named, tested ATS adapter handles the page.
    return { taskId: task.id, outcome: task.dryRun ? "READY" : "UNSUPPORTED", message: task.dryRun ? "Dry-run navigation completed. No form was submitted." : "No approved ATS adapter is available for this page.", evidence: { finalUrl: page.url() } };
  } finally {
    await browser.close();
  }
}

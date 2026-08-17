import { describe, expect, it } from "vitest";
import { runSafetySimulation } from "@/src/lib/applications/simulation";

describe("automation safety simulation", () => {
  it("passes only when normal fields proceed and unsafe cases stop", () => {
    const result = runSafetySimulation();
    expect(result).toEqual({ passed: true, checks: { safeSubmission: "READY", sensitiveStop: "ACTION_REQUIRED", captchaStop: "BLOCKED", missingAnswerStop: "ACTION_REQUIRED" } });
  });
});

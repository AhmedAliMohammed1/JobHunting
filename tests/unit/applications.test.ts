import { describe, expect, it } from "vitest";
import { runPreflight } from "@/src/lib/applications/preflight";
import { classifyFieldRisk } from "@/src/lib/applications/risk";
import { canTransition, transitionApplication } from "@/src/lib/applications/state-machine";

describe("application safety", () => {
  it("rejects invalid state jumps", () => {
    expect(canTransition("DISCOVERED", "SUBMITTED")).toBe(false);
    expect(() => transitionApplication("DISCOVERED", "SUBMITTED")).toThrow();
  });

  it("stops for CAPTCHA and sensitive fields", () => {
    expect(classifyFieldRisk({ label: "Visa sponsorship", type: "select" })).toBe("HIGH");
    const result = runPreflight([{ id: "visa", label: "Visa sponsorship", type: "select", required: true, value: "", sensitive: true }], { captcha: true });
    expect(result.status).toBe("BLOCKED");
    expect(result.blockers[0]).toContain("CAPTCHA");
  });
});

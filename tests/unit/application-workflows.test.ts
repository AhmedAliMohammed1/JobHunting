import { afterEach, describe, expect, it } from "vitest";
import { evaluateAutomationEligibility } from "@/src/lib/applications/eligibility";
import { mapFields } from "@/src/lib/applications/field-mapper";
import { analyzeForm } from "@/src/lib/applications/form-analyzer";
import { genericApplicationProvider } from "@/src/lib/applications/providers/generic";
import { validateApplication, validateField } from "@/src/lib/applications/validator";
import type { NormalizedJob } from "@/src/types/jobs";

const job: NormalizedJob = { id: "1", provider: "test", title: "Engineer", company: "Acme", workplaceType: "remote", skills: [], firstDiscoveredAt: new Date().toISOString(), lastSeenAt: new Date().toISOString(), sourceUrl: "https://jobs.example/1", applicationUrl: "https://jobs.example/apply", status: "ACTIVE", freshnessLabel: "live" };

describe("application workflow helpers", () => {
  afterEach(() => { delete process.env.FEATURE_AUTO_APPLY; });
  it("analyzes controls, maps approved facts, and leaves unknowns for review", () => {
    const fields = analyzeForm([{ id: "name", label: "Full name", type: "text", required: true }, { id: "visa", label: "Visa sponsorship", type: "mystery" }]);
    expect(fields[1]).toMatchObject({ type: "text", sensitive: true });
    const mapped = mapFields(fields, [{ key: "fullName", value: "Sam", source: "user-profile" }]);
    expect(mapped[0]).toMatchObject({ value: "Sam", confidence: 1, unknown: false });
    expect(mapped[1]).toMatchObject({ confidence: 0, unknown: true });
  });

  it("validates required, email, phone, and size constraints", () => {
    expect(validateField({ id: "e", label: "Email", type: "email", required: true, value: "bad" })).toContain("Email format is invalid.");
    expect(validateField({ id: "p", label: "Phone", type: "phone", required: false, value: "x" })).toContain("Phone format is invalid.");
    expect(validateApplication([{ id: "x", label: "Required", type: "text", required: true }, { id: "ok", label: "Name", type: "text", required: true, value: "Sam" }])).toHaveLength(1);
  });

  it("requires every automation gate and respects hard limits", () => {
    process.env.FEATURE_AUTO_APPLY = "true";
    expect(evaluateAutomationEligibility(job, { simulationPassed: true, dailyCount: 0, weeklyCount: 0, companyTodayCount: 0, domainAllowed: true }).eligible).toBe(true);
    const blocked = evaluateAutomationEligibility({ ...job, status: "EXPIRED" }, { simulationPassed: false, dailyCount: 25, weeklyCount: 100, companyTodayCount: 5, domainAllowed: false });
    expect(blocked.eligible).toBe(false); expect(blocked.reasons).toHaveLength(6);
  });

  it("keeps the generic provider analysis-only", async () => {
    const task = { id: "1", applicationUrl: "https://jobs.example/apply", dryRun: true, fields: [] };
    expect(genericApplicationProvider.supports(new URL(task.applicationUrl))).toBe(true);
    expect((await genericApplicationProvider.analyze(task)).state).toBe("WAITING_FOR_USER");
    expect((await genericApplicationProvider.submit(task)).state).toBe("READY");
    expect((await genericApplicationProvider.submit({ ...task, dryRun: false })).state).toBe("UNSUPPORTED");
  });
});

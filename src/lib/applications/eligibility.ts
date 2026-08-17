import { AUTOMATION_LIMITS, isFeatureEnabled } from "@/src/config/features";
import type { NormalizedJob } from "@/src/types/jobs";

export interface EligibilityContext {
  simulationPassed: boolean;
  dailyCount: number;
  weeklyCount: number;
  companyTodayCount: number;
  dailyLimit?: number;
  weeklyLimit?: number;
  companyDailyLimit?: number;
  domainAllowed: boolean;
}

export function evaluateAutomationEligibility(job: NormalizedJob, context: EligibilityContext) {
  const reasons: string[] = [];
  if (!isFeatureEnabled("AUTO_APPLY")) reasons.push("Auto-apply is disabled by feature flag.");
  if (!context.simulationPassed) reasons.push("A successful dry-run simulation is required.");
  if (!context.domainAllowed) reasons.push("The application domain is not allowlisted.");
  if (["EXPIRED", "REMOVED", "UNKNOWN"].includes(job.status)) reasons.push("Job freshness is insufficient for automation.");
  if (context.dailyCount >= Math.min(context.dailyLimit ?? AUTOMATION_LIMITS.defaultDaily, AUTOMATION_LIMITS.maximumDaily)) reasons.push("Daily application limit reached.");
  if (context.weeklyCount >= Math.min(context.weeklyLimit ?? AUTOMATION_LIMITS.defaultWeekly, AUTOMATION_LIMITS.maximumWeekly)) reasons.push("Weekly application limit reached.");
  if (context.companyTodayCount >= Math.min(context.companyDailyLimit ?? AUTOMATION_LIMITS.defaultPerCompanyPerDay, AUTOMATION_LIMITS.maximumPerCompanyPerDay)) reasons.push("Per-company daily limit reached.");
  return { eligible: reasons.length === 0, reasons };
}

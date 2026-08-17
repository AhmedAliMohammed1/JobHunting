import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/src/config/features";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { automationSettingsInputSchema } from "@/src/lib/validation/product";

const fields = "enabled,simulation_completed_at,paused_at,minimum_match,company_whitelist,company_blacklist,daily_limit,weekly_limit,company_daily_limit,maximum_job_age_hours";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("automation_settings").select(fields).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load automation settings." }, { status: 500 });
  return NextResponse.json({ settings: data, policyEnabled: isFeatureEnabled("AUTO_APPLY") });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = automationSettingsInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the automation limits and allowlists." }, { status: 400 });
  const supabase = await createClient();
  const { data: current } = await supabase!.from("automation_settings").select("simulation_completed_at").eq("user_id", user.id).maybeSingle();
  if (parsed.data.enabled && !isFeatureEnabled("AUTO_APPLY")) return NextResponse.json({ error: "Auto-apply is disabled by server policy." }, { status: 403 });
  if (parsed.data.enabled && !current?.simulation_completed_at) return NextResponse.json({ error: "Run the safety simulation before enabling auto-apply." }, { status: 409 });
  const input = parsed.data;
  const { error } = await supabase!.from("automation_settings").upsert({ user_id: user.id, enabled: input.enabled, paused_at: input.enabled ? null : new Date().toISOString(), minimum_match: input.minimumMatch, daily_limit: input.dailyLimit, weekly_limit: input.weeklyLimit, company_daily_limit: input.companyDailyLimit, maximum_job_age_hours: input.maximumJobAgeHours, company_whitelist: input.companyWhitelist, company_blacklist: input.companyBlacklist }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Could not save automation settings." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

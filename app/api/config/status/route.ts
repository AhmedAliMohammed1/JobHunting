import { NextResponse } from "next/server";
import { getServerEnv, isSupabaseConfigured } from "@/src/config/env";
import { isFeatureEnabled } from "@/src/config/features";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const auth = isSupabaseConfigured();
  const database = auth && Boolean(env.SUPABASE_SECRET_KEY);
  const ai = env.AI_PROVIDER === "mock" || (env.AI_PROVIDER === "openai-compatible" && Boolean(env.AI_API_KEY && env.AI_MODEL));
  const jobs = env.JOB_PROVIDER_MODE === "mock" || (env.JOB_PROVIDER_MODE === "live" && env.ENABLE_REMOTIVE === "true");
  return NextResponse.json({
    ready: auth && database && ai && jobs,
    services: { auth, database, ai, jobs, worker: Boolean(env.AUTOMATION_WORKER_URL) },
    modes: { ai: env.AI_PROVIDER, jobs: env.JOB_PROVIDER_MODE },
    features: {
      autoApply: isFeatureEnabled("AUTO_APPLY"),
      browserAutomation: isFeatureEnabled("BROWSER_AUTOMATION"),
      emailAlerts: isFeatureEnabled("EMAIL_ALERTS"),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

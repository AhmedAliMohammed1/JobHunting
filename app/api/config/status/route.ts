import { NextResponse } from "next/server";
import { effectiveJobProviderMode, getServerEnv, isSupabaseConfigured } from "@/src/config/env";
import { configuredJobProviders } from "@/src/lib/jobs/providers";
import { isFeatureEnabled } from "@/src/config/features";
import { jobProviderCatalog } from "@/src/lib/jobs/providers/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const env = getServerEnv();
  const auth = isSupabaseConfigured();
  const database = auth && Boolean(env.SUPABASE_SECRET_KEY);
  const ai = env.AI_PROVIDER === "mock" || (env.AI_PROVIDER === "openai-compatible" && Boolean(env.AI_API_KEY && env.AI_MODEL));
  const jobMode = effectiveJobProviderMode(env);
  const jobProviders = configuredJobProviders().map((provider) => provider.id);
  const jobs = jobProviders.length > 0;
  return NextResponse.json({
    ready: auth && database && ai && jobs,
    services: { auth, database, ai, jobs, worker: Boolean(env.AUTOMATION_WORKER_URL) },
    modes: { ai: env.AI_PROVIDER, jobs: jobMode },
    providers: jobProviders,
    providerCatalog: jobProviderCatalog(env),
    features: {
      autoApply: isFeatureEnabled("AUTO_APPLY"),
      browserAutomation: isFeatureEnabled("BROWSER_AUTOMATION"),
      emailAlerts: isFeatureEnabled("EMAIL_ALERTS"),
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

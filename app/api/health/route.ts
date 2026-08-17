import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/database/supabase/server";
import { isSupabaseConfigured } from "@/src/config/env";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ok" | "degraded" | "not_configured" = "not_configured";
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const result = await supabase?.from("provider_health").select("id", { head: true, count: "exact" }).limit(1);
      database = result?.error ? "degraded" : "ok";
    } catch {
      database = "degraded";
    }
  }

  const degraded = database === "degraded";
  return NextResponse.json(
    {
      status: degraded ? "degraded" : "ok",
      ready: database === "ok",
      timestamp: new Date().toISOString(),
      components: {
        application: "ok",
        database,
        auth: isSupabaseConfigured() ? "configured" : "not_configured",
        queue: process.env.SUPABASE_SECRET_KEY ? "database-backed" : "not_configured",
        worker: process.env.AUTOMATION_WORKER_URL ? "configured" : "not_configured",
      },
    },
    {
      status: degraded ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

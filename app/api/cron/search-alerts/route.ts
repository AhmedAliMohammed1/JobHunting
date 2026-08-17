import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/database/supabase/admin";
import { searchJobs } from "@/src/lib/jobs/search";
import { deliverInAppJobAlert } from "@/src/lib/notifications/delivery";
import { jobSearchSchema } from "@/src/lib/validation/search";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Scheduler unavailable" }, { status: 503 });
  const now = new Date();
  const { data: searches, error } = await admin.from("saved_searches").select("id,user_id,query,schedule").eq("enabled", true).lte("next_run_at", now.toISOString()).order("next_run_at").limit(3);
  if (error) return NextResponse.json({ error: "Scheduler unavailable" }, { status: 503 });
  let delivered = 0;
  for (const saved of searches ?? []) {
    try {
      const query = jobSearchSchema.parse(saved.query);
      const result = await searchJobs(query);
      for (const job of result.jobs.slice(0, 10)) {
        const outcome = await deliverInAppJobAlert(admin, saved.user_id, saved.id, job);
        if (outcome.delivered) delivered += 1;
      }
      const intervalHours = saved.schedule === "hourly" ? 1 : 24;
      await admin.from("saved_searches").update({ last_run_at: now.toISOString(), next_run_at: new Date(now.getTime() + intervalHours * 3_600_000).toISOString() }).eq("id", saved.id);
    } catch {
      // Leave next_run_at unchanged for a bounded retry on the next scheduled invocation.
    }
  }
  return NextResponse.json({ processed: searches?.length ?? 0, delivered });
}

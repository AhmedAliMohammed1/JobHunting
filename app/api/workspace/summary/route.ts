import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
  const supabase = await createClient();
  const [saved, applications, unread, profile, automation] = await Promise.all([
    supabase!.from("saved_jobs").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("archived_at", null),
    supabase!.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase!.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null),
    supabase!.from("candidate_profiles").select("preferred_roles,skills").eq("user_id", user.id).maybeSingle(),
    supabase!.from("automation_settings").select("enabled,simulation_completed_at").eq("user_id", user.id).maybeSingle(),
  ]);
  if ([saved, applications, unread, profile, automation].some((result) => result.error)) return NextResponse.json({ error: "Could not load the workspace summary." }, { status: 500, headers: privateHeaders });
  return NextResponse.json({
    counts: { savedJobs: saved.count ?? 0, applications: applications.count ?? 0, unreadNotifications: unread.count ?? 0 },
    profileComplete: Boolean(profile.data?.preferred_roles?.length && profile.data?.skills?.length),
    automation: automation.data ?? { enabled: false, simulation_completed_at: null },
  }, { headers: privateHeaders });
}

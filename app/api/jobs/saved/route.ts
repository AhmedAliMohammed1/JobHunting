import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createAdminClient } from "@/src/lib/database/supabase/admin";
import { createClient } from "@/src/lib/database/supabase/server";
import { persistNormalizedJob } from "@/src/lib/jobs/persistence";
import { saveJobInputSchema } from "@/src/lib/validation/product";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("saved_jobs").select("id,job_id,priority,notes,created_at,job:jobs(id,title,company,location,workplace_type,employment_type,salary_text,posted_at,status,job_sources(source_url,application_url,provider,last_verified_at),job_skills(skill))").eq("user_id", user.id).is("archived_at", null).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load saved jobs." }, { status: 500 });
  return NextResponse.json({ savedJobs: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save jobs." }, { status: 401 });
  const parsed = saveJobInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The job data is invalid or incomplete." }, { status: 400 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Database persistence is not configured." }, { status: 503 });
  try {
    const jobId = await persistNormalizedJob(admin, parsed.data.job);
    const supabase = await createClient();
    const { data, error } = await supabase!.from("saved_jobs").upsert({ user_id: user.id, job_id: jobId, priority: parsed.data.priority, notes: parsed.data.notes ?? null, archived_at: null }, { onConflict: "user_id,job_id" }).select("id,job_id,priority,notes").single();
    if (error) throw new Error("Could not add the job to your shortlist.");
    return NextResponse.json({ savedJob: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the job." }, { status: 500 });
  }
}

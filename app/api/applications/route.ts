import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { applicationCreateSchema } from "@/src/lib/validation/product";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("applications").select("id,state,stage,mode,risk,application_url,confirmation_status,applied_at,created_at,updated_at,job:jobs(id,title,company,location,status)").eq("user_id", user.id).order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load applications." }, { status: 500 });
  return NextResponse.json({ applications: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = applicationCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid job selection." }, { status: 400 });
  const supabase = await createClient();
  const idempotencyKey = `${parsed.data.jobId}:manual`;
  const { data, error } = await supabase!.from("applications").upsert({ user_id: user.id, job_id: parsed.data.jobId, state: "DISCOVERED", stage: "Planning", mode: "manual", risk: "LOW", application_url: parsed.data.applicationUrl ?? null, idempotency_key: idempotencyKey }, { onConflict: "user_id,job_id" }).select("id,stage,state").single();
  if (error) return NextResponse.json({ error: "Could not track this application." }, { status: 500 });
  return NextResponse.json({ application: data }, { status: 201 });
}

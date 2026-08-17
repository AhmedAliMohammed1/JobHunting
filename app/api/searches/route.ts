import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { savedSearchInputSchema } from "@/src/lib/validation/product";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("saved_searches").select("id,name,query,enabled,schedule,minimum_match_score,last_run_at,next_run_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load saved searches." }, { status: 500 });
  return NextResponse.json({ searches: data ?? [] });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = savedSearchInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the search profile fields." }, { status: 400 });
  const input = parsed.data;
  const now = new Date();
  const nextRunAt = input.enabled ? new Date(now.getTime() + (input.schedule === "hourly" ? 1 : 24) * 3_600_000).toISOString() : null;
  const supabase = await createClient();
  const { data, error } = await supabase!.from("saved_searches").insert({ user_id: user.id, name: input.name, query: input.query, enabled: input.enabled, schedule: input.schedule, minimum_match_score: input.minimumMatchScore, next_run_at: nextRunAt }).select("id,name,query,enabled,schedule,minimum_match_score,next_run_at").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A saved search with that name already exists." : "Could not save the search." }, { status: error.code === "23505" ? 409 : 500 });
  return NextResponse.json({ search: data }, { status: 201 });
}

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("automation_tasks").select("id,task_type,status,attempts,created_at,updated_at,completed_at,application:applications(id,job:jobs(title,company))").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load automation activity." }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

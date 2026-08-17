import { NextResponse } from "next/server";
import { runSafetySimulation } from "@/src/lib/applications/simulation";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const simulation = runSafetySimulation();
  if (!simulation.passed) return NextResponse.json({ error: "Safety rules failed their self-test.", simulation }, { status: 500 });
  const supabase = await createClient();
  const completedAt = new Date().toISOString();
  const { error } = await supabase!.from("automation_settings").upsert({ user_id: user.id, enabled: false, simulation_completed_at: completedAt }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Could not record the simulation." }, { status: 500 });
  return NextResponse.json({ simulation, completedAt });
}

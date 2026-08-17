import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/database/supabase/server";

export async function POST() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Authentication is not configured." }, { status: 503 });
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: "Could not sign out." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

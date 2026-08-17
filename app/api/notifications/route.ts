import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { idSchema } from "@/src/lib/validation/product";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("notifications").select("id,type,title,body,data,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "Could not load notifications." }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = await request.json().catch(() => null) as { id?: unknown; all?: unknown } | null;
  const supabase = await createClient();
  let query = supabase!.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (input?.all !== true) {
    const id = idSchema.safeParse(input?.id);
    if (!id.success) return NextResponse.json({ error: "Invalid notification." }, { status: 400 });
    query = query.eq("id", id.data);
  }
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Could not update notifications." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

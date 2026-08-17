import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { idSchema } from "@/src/lib/validation/product";

async function context(params: Promise<{ id: string }>) {
  const user = await getCurrentUser();
  const id = idSchema.safeParse((await params).id);
  return { user, id };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, id } = await context(params);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!id.success) return NextResponse.json({ error: "Invalid saved search." }, { status: 400 });
  const input = await request.json().catch(() => null) as { enabled?: unknown } | null;
  if (typeof input?.enabled !== "boolean") return NextResponse.json({ error: "Enabled must be true or false." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase!.from("saved_searches").update({ enabled: input.enabled, next_run_at: input.enabled ? new Date(Date.now() + 86_400_000).toISOString() : null }).eq("id", id.data).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update the saved search." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, id } = await context(params);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!id.success) return NextResponse.json({ error: "Invalid saved search." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase!.from("saved_searches").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not delete the saved search." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

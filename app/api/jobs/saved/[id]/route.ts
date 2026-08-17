import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { idSchema } from "@/src/lib/validation/product";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsedId = idSchema.safeParse((await params).id);
  if (!parsedId.success) return NextResponse.json({ error: "Invalid saved job." }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase!.from("saved_jobs").delete().eq("id", parsedId.data).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not remove the saved job." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

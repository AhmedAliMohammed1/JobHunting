import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { idSchema } from "@/src/lib/validation/product";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid CV document." }, { status: 400 });
  const supabase = await createClient();
  const { data, error: loadError } = await supabase!.from("cv_documents").select("storage_path").eq("id", id.data).eq("user_id", user.id).is("deleted_at", null).maybeSingle();
  if (loadError || !data) return NextResponse.json({ error: "CV document not found." }, { status: 404 });
  const { error: storageError } = await supabase!.storage.from("cvs").remove([data.storage_path]);
  if (storageError) return NextResponse.json({ error: "Could not delete the private file." }, { status: 500 });
  const { error } = await supabase!.from("cv_documents").update({ deleted_at: new Date().toISOString() }).eq("id", id.data).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Could not update the CV record." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

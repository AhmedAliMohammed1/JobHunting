import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("cv_documents").select("id,original_filename,mime_type,size_bytes,parse_status,parse_error,parsed_at,created_at").eq("user_id", user.id).is("deleted_at", null).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Could not load CV documents." }, { status: 500 });
  return NextResponse.json({ documents: data ?? [] }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

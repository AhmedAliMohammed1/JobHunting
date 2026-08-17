import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const allowed = new Set([PDF, DOCX]);

function hasValidSignature(type: string, bytes: Uint8Array) {
  if (type === PDF) return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in before uploading a CV." }, { status: 401 });
  const data = await request.formData();
  const file = data.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required." }, { status: 400 });
  if (!allowed.has(file.type) || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Use a PDF or DOCX file no larger than 8 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasValidSignature(file.type, bytes)) return NextResponse.json({ error: "The file contents do not match the declared format." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Storage is not configured." }, { status: 503 });
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const sha256 = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  const { data: duplicate } = await supabase.from("cv_documents").select("id").eq("user_id", user.id).eq("sha256", sha256).is("deleted_at", null).maybeSingle();
  if (duplicate) return NextResponse.json({ error: "This CV version has already been uploaded." }, { status: 409 });
  const extension = file.type === PDF ? "pdf" : "docx";
  const key = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("cvs").upload(key, bytes, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: "Private storage rejected the upload." }, { status: 500 });
  const { data: document, error: metadataError } = await supabase.from("cv_documents").insert({ user_id: user.id, storage_path: key, original_filename: file.name.slice(0, 500), mime_type: file.type, size_bytes: file.size, sha256, parse_status: "PENDING" }).select("id,original_filename,parse_status,created_at").single();
  if (metadataError || !document) {
    await supabase.storage.from("cvs").remove([key]);
    return NextResponse.json({ error: "The CV was not recorded; the uploaded file was rolled back." }, { status: 500 });
  }
  return NextResponse.json({ document, status: "uploaded" }, { status: 201 });
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";
import { extractText } from "npm:unpdf@1.6.2";
import mammoth from "npm:mammoth@1.12.0";
import { Buffer } from "node:buffer";

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_EXTRACTED_CHARS = 120_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown parser error";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return json({ error: "Parser service is not configured." }, 503);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json({ error: "Unauthorized." }, 401);

  const payload = await request.json().catch(() => null) as { documentId?: unknown } | null;
  const documentId = typeof payload?.documentId === "string" ? payload.documentId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(documentId)) {
    return json({ error: "Invalid CV document." }, 400);
  }

  const { data: document, error: documentError } = await admin
    .from("cv_documents")
    .select("id,user_id,storage_path,mime_type,parse_status")
    .eq("id", documentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (documentError) return json({ error: "Could not load the CV metadata." }, 500);
  if (!document || document.user_id !== user.id) return json({ error: "CV document not found." }, 404);
  if (document.mime_type !== PDF && document.mime_type !== DOCX) return json({ error: "Unsupported CV format." }, 415);

  await admin.from("cv_documents").update({ parse_status: "PROCESSING", parse_error: null }).eq("id", document.id);

  try {
    const { data: storedFile, error: downloadError } = await admin.storage.from("cvs").download(document.storage_path);
    if (downloadError || !storedFile) throw new Error("Could not read the private CV file.");

    const bytes = new Uint8Array(await storedFile.arrayBuffer());
    let extracted = "";

    if (document.mime_type === PDF) {
      const result = await extractText(bytes, { mergePages: true });
      extracted = result.text;
    } else {
      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      extracted = result.value;
    }

    extracted = extracted.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim();
    if (extracted.length < 40) throw new Error("No machine-readable text could be extracted from this CV. A scanned/image-only PDF may need OCR.");

    const storedText = extracted.slice(0, MAX_EXTRACTED_CHARS);
    const { error: updateError } = await admin.from("cv_documents").update({
      extracted_text: storedText,
      parse_status: "COMPLETE",
      parsed_at: new Date().toISOString(),
      parse_error: null,
    }).eq("id", document.id).eq("user_id", user.id);
    if (updateError) throw new Error("Could not save the extracted CV text.");

    return json({ ok: true, documentId: document.id, characters: storedText.length, truncated: extracted.length > storedText.length });
  } catch (error) {
    const message = safeMessage(error);
    await admin.from("cv_documents").update({ parse_status: "FAILED", parse_error: message }).eq("id", document.id).eq("user_id", user.id);
    return json({ error: message }, 422);
  }
});

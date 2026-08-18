import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { idSchema } from "@/src/lib/validation/product";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

function safeError(value: unknown) {
  if (!value || typeof value !== "object" || !("error" in value)) return "CV text extraction failed.";
  const error = (value as { error?: unknown }).error;
  return typeof error === "string" && error.trim() ? error.slice(0, 500) : "CV text extraction failed.";
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid CV document." }, { status: 400, headers: privateHeaders });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Database is not configured." }, { status: 503, headers: privateHeaders });

  const { data: document, error: documentError } = await supabase
    .from("cv_documents")
    .select("id")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (documentError) return NextResponse.json({ error: "Could not load the CV document." }, { status: 500, headers: privateHeaders });
  if (!document) return NextResponse.json({ error: "CV document not found." }, { status: 404, headers: privateHeaders });

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (sessionError || !accessToken) return NextResponse.json({ error: "Your session expired. Sign in again and retry." }, { status: 401, headers: privateHeaders });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return NextResponse.json({ error: "CV parsing is not configured." }, { status: 503, headers: privateHeaders });

  try {
    const response = await fetch(`${url.replace(/\/$/, "")}/functions/v1/parse-cv`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ documentId: id.data }),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    });

    const body = await response.json().catch(() => null) as unknown;
    if (!response.ok) return NextResponse.json({ error: safeError(body) }, { status: response.status, headers: privateHeaders });
    return NextResponse.json(body ?? { ok: true }, { headers: privateHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "CV parser request failed.";
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 502, headers: privateHeaders });
  }
}

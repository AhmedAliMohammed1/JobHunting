import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/database/supabase/server";
import { safeReturnPath } from "@/src/lib/auth/paths";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"));
  if (code) {
    const supabase = await createClient();
    const result = await supabase?.auth.exchangeCodeForSession(code);
    if (!result?.error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=confirmation_failed", url.origin));
}

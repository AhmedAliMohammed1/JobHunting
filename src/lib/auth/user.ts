import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/database/supabase/server";

export async function getCurrentUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return {
    id: String(data.claims.sub),
    email: typeof data.claims.email === "string" ? data.claims.email : undefined,
  };
}

export async function requireUser(returnTo = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}


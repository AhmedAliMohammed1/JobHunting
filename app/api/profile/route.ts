import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { candidateProfileInputSchema } from "@/src/lib/validation/product";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("candidate_profiles").select("full_name,current_title,location,summary,skills,preferred_roles,preferred_countries,preferred_locations,employment_types,workplace_types,years_experience").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load your profile." }, { status: 500, headers: privateHeaders });
  return NextResponse.json({ profile: data }, { headers: privateHeaders });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = candidateProfileInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the profile fields and try again." }, { status: 400 });
  const input = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase!.from("candidate_profiles").upsert({
    user_id: user.id,
    full_name: input.fullName || null,
    current_title: input.currentTitle || null,
    location: input.location || null,
    summary: input.summary || null,
    skills: input.skills.map((name) => ({ name, source: "user" })),
    preferred_roles: input.preferredRoles,
    preferred_countries: input.preferredCountries,
    preferred_locations: input.preferredLocations,
    employment_types: input.employmentTypes,
    workplace_types: input.workplaceTypes,
    years_experience: input.yearsExperience,
    manual_fields: ["full_name", "current_title", "location", "summary", "skills", "years_experience", "preferences"],
  }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ error: "Could not save your profile." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

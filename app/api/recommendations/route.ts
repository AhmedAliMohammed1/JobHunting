import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { searchJobs } from "@/src/lib/jobs/search";
import { rankJobs } from "@/src/lib/matching/rank";
import { jobSearchSchema } from "@/src/lib/validation/search";
import type { CandidateProfile, CandidateSkill } from "@/src/types/candidate";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("candidate_profiles").select("id,full_name,current_title,location,summary,skills,programming_languages,frameworks,tools,certifications,languages,years_experience,preferred_roles,preferred_countries,preferred_locations,employment_types,workplace_types,manual_fields").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load your matching profile." }, { status: 500 });
  if (!data?.preferred_roles?.length) return NextResponse.json({ recommendations: [], reason: "Add at least one target role to your profile." });
  const profile: CandidateProfile = {
    id: data.id,
    userId: user.id,
    fullName: data.full_name ?? undefined,
    currentTitle: data.current_title ?? undefined,
    location: data.location ?? undefined,
    summary: data.summary ?? undefined,
    skills: Array.isArray(data.skills) ? data.skills.filter((skill): skill is CandidateSkill => Boolean(skill && typeof skill === "object" && "name" in skill)) : [],
    programmingLanguages: data.programming_languages ?? [], frameworks: data.frameworks ?? [], tools: data.tools ?? [], certifications: data.certifications ?? [], languages: data.languages ?? [],
    yearsExperience: data.years_experience == null ? undefined : Number(data.years_experience), preferredRoles: data.preferred_roles ?? [], preferredCountries: data.preferred_countries ?? [], preferredLocations: data.preferred_locations ?? [], employmentTypes: data.employment_types ?? [], workplaceTypes: data.workplace_types ?? [], manualFields: data.manual_fields ?? [],
  };
  const query = jobSearchSchema.parse({ roles: profile.preferredRoles, countries: profile.preferredCountries, locations: profile.preferredLocations, employmentTypes: profile.employmentTypes, workplaceTypes: profile.workplaceTypes, limit: 25 });
  const result = await searchJobs(query);
  return NextResponse.json({ recommendations: rankJobs(profile, result.jobs).slice(0, 20), partial: result.partial, providers: result.providers.map((provider) => provider.health) });
}

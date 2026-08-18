import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { createClient } from "@/src/lib/database/supabase/server";
import { searchJobs } from "@/src/lib/jobs/search";
import { rankJobs } from "@/src/lib/matching/rank";
import { deriveCandidateSearchRoles } from "@/src/lib/matching/role-inference";
import { jobSearchSchema } from "@/src/lib/validation/search";
import type { CandidateProfile, CandidateSkill } from "@/src/types/candidate";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: privateHeaders });
  const supabase = await createClient();
  const { data, error } = await supabase!.from("candidate_profiles").select("id,full_name,current_title,location,summary,skills,programming_languages,frameworks,tools,certifications,languages,years_experience,preferred_roles,preferred_countries,preferred_locations,employment_types,workplace_types,manual_fields").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load your matching profile." }, { status: 500, headers: privateHeaders });
  if (!data) return NextResponse.json({ recommendations: [], reason: "Upload a CV or complete your profile to get recommendations." }, { headers: privateHeaders });

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

  const roles = deriveCandidateSearchRoles(profile);
  const inferredRoles = profile.preferredRoles.length === 0;
  const query = jobSearchSchema.parse({
    roles,
    countries: profile.preferredCountries,
    locations: profile.preferredLocations,
    employmentTypes: profile.employmentTypes,
    workplaceTypes: profile.workplaceTypes,
    limit: 40,
  });
  const result = await searchJobs(query);
  if (!result.jobs.length) {
    return NextResponse.json({
      recommendations: [],
      reason: inferredRoles
        ? `No live jobs were returned for the CV-derived roles (${roles.slice(0, 4).join(", ")}). Try adding broader target roles or locations in your profile.`
        : "No jobs match all of your current role, location, employment, and workplace preferences. Try broadening one preference.",
      inferredRoles: inferredRoles ? roles : [],
      partial: result.partial,
      providers: result.providers.map((provider) => provider.health),
    }, { headers: privateHeaders });
  }

  const recommendations = rankJobs(profile, result.jobs).slice(0, 20);
  const reason = inferredRoles
    ? `Automatically searched CV-derived roles: ${roles.slice(0, 5).join(", ")}. Ranked by CV context, skills, title fit, preferences, and freshness.`
    : "Ranked using your target roles plus the skills and experience extracted from your CV.";

  return NextResponse.json({
    recommendations,
    reason,
    inferredRoles: inferredRoles ? roles : [],
    partial: result.partial,
    providers: result.providers.map((provider) => provider.health),
  }, { headers: privateHeaders });
}

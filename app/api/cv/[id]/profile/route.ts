import { NextResponse } from "next/server";
import { getCurrentUser } from "@/src/lib/auth/user";
import { getAIProvider } from "@/src/lib/ai/provider";
import { mergeAuthoritativeProfile, parseCandidateText, type CandidateProfileExtraction } from "@/src/lib/ai/candidate-parser";
import { createClient } from "@/src/lib/database/supabase/server";
import { idSchema } from "@/src/lib/validation/product";

export const maxDuration = 140;

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0" };

const manualFieldMap: Record<string, keyof CandidateProfileExtraction> = {
  full_name: "fullName",
  current_title: "currentTitle",
  location: "location",
  summary: "summary",
  skills: "skills",
  programming_languages: "programmingLanguages",
  frameworks: "frameworks",
  tools: "tools",
  certifications: "certifications",
  languages: "languages",
  years_experience: "yearsExperience",
};

function skillNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [item.trim()] : [];
    if (item && typeof item === "object" && "name" in item && typeof item.name === "string" && item.name.trim()) return [item.name.trim()];
    return [];
  });
}

function normalizedLanguages(value: unknown): CandidateProfileExtraction["languages"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || !("name" in item) || typeof item.name !== "string" || !item.name.trim()) return [];
    const level = "level" in item && typeof item.level === "string" && item.level.trim() ? item.level.trim() : null;
    return [{ name: item.name.trim(), level }];
  });
}

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown AI error";
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 400);
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
    .select("id,parse_status,extracted_text")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (documentError) return NextResponse.json({ error: "Could not load the parsed CV." }, { status: 500, headers: privateHeaders });
  if (!document) return NextResponse.json({ error: "CV document not found." }, { status: 404, headers: privateHeaders });
  if (typeof document.extracted_text !== "string" || document.extracted_text.trim().length < 40) {
    return NextResponse.json({ error: "Extract the CV text successfully before building the AI profile." }, { status: 409, headers: privateHeaders });
  }

  const provider = getAIProvider();
  if (provider.id !== "openai-compatible") {
    return NextResponse.json({ error: "Live AI profile extraction is not configured." }, { status: 503, headers: privateHeaders });
  }

  await supabase.from("cv_documents").update({ parse_status: "PROCESSING", parse_error: null }).eq("id", document.id).eq("user_id", user.id);

  try {
    const extracted = await parseCandidateText(provider, document.extracted_text);
    const { data: existing, error: profileLoadError } = await supabase
      .from("candidate_profiles")
      .select("full_name,current_title,location,summary,skills,programming_languages,frameworks,tools,certifications,languages,years_experience,manual_fields")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileLoadError) throw new Error("Could not load the existing profile.");

    const current: CandidateProfileExtraction = {
      fullName: existing?.full_name ?? null,
      currentTitle: existing?.current_title ?? null,
      location: existing?.location ?? null,
      summary: existing?.summary ?? null,
      skills: skillNames(existing?.skills),
      programmingLanguages: existing?.programming_languages ?? [],
      frameworks: existing?.frameworks ?? [],
      tools: existing?.tools ?? [],
      education: [],
      employment: [],
      projects: [],
      certifications: existing?.certifications ?? [],
      languages: normalizedLanguages(existing?.languages),
      yearsExperience: existing?.years_experience == null ? null : Number(existing.years_experience),
    };

    const manualFields: string[] = (existing?.manual_fields ?? []).flatMap((field: string) => manualFieldMap[field] ? [manualFieldMap[field]] : []);
    const merged = mergeAuthoritativeProfile(current, extracted, manualFields);
    const preserveManualSkills = manualFields.includes("skills") && current.skills.length > 0;
    const skillsToSave = preserveManualSkills ? existing?.skills : merged.skills.map((name) => ({ name, source: "cv" }));

    const { data: saved, error: saveError } = await supabase.from("candidate_profiles").upsert({
      user_id: user.id,
      full_name: merged.fullName,
      current_title: merged.currentTitle,
      location: merged.location,
      summary: merged.summary,
      skills: skillsToSave,
      programming_languages: merged.programmingLanguages,
      frameworks: merged.frameworks,
      tools: merged.tools,
      certifications: merged.certifications,
      languages: merged.languages,
      years_experience: merged.yearsExperience,
      source_cv_document_id: document.id,
      manual_fields: existing?.manual_fields ?? [],
    }, { onConflict: "user_id" }).select("full_name,current_title,location,summary,skills,programming_languages,frameworks,tools,certifications,languages,years_experience,source_cv_document_id").single();

    if (saveError || !saved) throw new Error("Could not save the AI-extracted profile.");

    await supabase.from("cv_documents").update({ parse_status: "COMPLETE", parsed_at: new Date().toISOString(), parse_error: null }).eq("id", document.id).eq("user_id", user.id);

    return NextResponse.json({ profile: saved }, { headers: privateHeaders });
  } catch (error) {
    const message = safeMessage(error);
    await supabase.from("cv_documents").update({
      parse_status: "COMPLETE",
      parse_error: `AI profile extraction failed: ${message}`,
    }).eq("id", document.id).eq("user_id", user.id);
    return NextResponse.json({ error: `AI profile extraction failed: ${message}` }, { status: 502, headers: privateHeaders });
  }
}

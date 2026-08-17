"use client";

import { useEffect, useState, type FormEvent } from "react";
import { splitList } from "@/src/lib/validation/product";

type ProfileResponse = { profile: null | Record<string, unknown>; error?: string };

export function ProfileEditor() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState("Loading your profile…");

  useEffect(() => {
    fetch("/api/profile").then(async (response) => ({ response, body: await response.json() as ProfileResponse })).then(({ response, body }) => {
      if (!response.ok) throw new Error(body.error ?? "Could not load your profile.");
      setProfile(body.profile ?? {});
      setMessage("");
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("Saving…");
    const payload = {
      fullName: String(form.get("fullName") ?? ""), currentTitle: String(form.get("currentTitle") ?? ""), location: String(form.get("location") ?? ""), summary: String(form.get("summary") ?? ""),
      skills: splitList(String(form.get("skills") ?? "")), preferredRoles: splitList(String(form.get("preferredRoles") ?? "")), preferredCountries: splitList(String(form.get("preferredCountries") ?? "")), preferredLocations: splitList(String(form.get("preferredLocations") ?? "")), employmentTypes: splitList(String(form.get("employmentTypes") ?? "")),
      workplaceTypes: form.getAll("workplaceTypes").map(String), yearsExperience: form.get("yearsExperience") ? Number(form.get("yearsExperience")) : null,
    };
    const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json() as { error?: string };
    setMessage(response.ok ? "Profile saved. Recommendations now use these facts." : body.error ?? "Could not save your profile.");
  }

  if (!profile) return <div className="product-card" role="status">{message}</div>;
  const list = (key: string) => Array.isArray(profile[key]) ? (profile[key] as Array<string | { name?: string }>).map((item) => typeof item === "string" ? item : item.name).filter(Boolean).join(", ") : "";
  return <form className="profile-form" onSubmit={save}>
    <div className="form-grid"><label>Full name<input name="fullName" defaultValue={String(profile.full_name ?? "")} autoComplete="name" /></label><label>Current title<input name="currentTitle" defaultValue={String(profile.current_title ?? "")} /></label><label>Location<input name="location" defaultValue={String(profile.location ?? "")} autoComplete="address-level2" /></label><label>Years of experience<input name="yearsExperience" type="number" min="0" max="80" step="0.5" defaultValue={profile.years_experience == null ? "" : String(profile.years_experience)} /></label></div>
    <label>Professional summary<textarea name="summary" defaultValue={String(profile.summary ?? "")} rows={5} /></label>
    <label>Core skills <small>Comma-separated</small><textarea name="skills" defaultValue={list("skills")} /></label>
    <label>Target roles<input name="preferredRoles" defaultValue={list("preferred_roles")} /></label>
    <div className="form-grid"><label>Preferred countries<input name="preferredCountries" defaultValue={list("preferred_countries")} /></label><label>Preferred locations<input name="preferredLocations" defaultValue={list("preferred_locations")} /></label><label>Employment types<input name="employmentTypes" defaultValue={list("employment_types")} placeholder="Full-time, Contract" /></label></div>
    <fieldset><legend>Workplace preference</legend>{["remote", "hybrid", "onsite"].map((value) => <label className="inline-control" key={value}><input name="workplaceTypes" type="checkbox" value={value} defaultChecked={(profile.workplace_types as string[] | undefined)?.includes(value)} /> {value}</label>)}</fieldset>
    <button type="submit">Save profile</button><p className="form-status" role="status">{message}</p>
  </form>;
}

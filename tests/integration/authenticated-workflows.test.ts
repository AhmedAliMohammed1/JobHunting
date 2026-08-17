import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(), createClient: vi.fn(), createAdminClient: vi.fn(), persistNormalizedJob: vi.fn(),
}));
vi.mock("@/src/lib/auth/user", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/src/lib/database/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/src/lib/database/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/src/lib/jobs/persistence", () => ({ persistNormalizedJob: mocks.persistNormalizedJob }));

import { POST as logout } from "@/app/api/account/logout/route";
import { POST as createApplication } from "@/app/api/applications/route";
import { POST as uploadCv } from "@/app/api/cv/upload/route";
import { POST as saveJob } from "@/app/api/jobs/saved/route";
import { PATCH as markNotification } from "@/app/api/notifications/route";
import { PUT as saveProfile } from "@/app/api/profile/route";
import { GET as getRecommendations } from "@/app/api/recommendations/route";
import { POST as saveSearch } from "@/app/api/searches/route";
import { PUT as saveAutomation } from "@/app/api/settings/automation/route";

type Result = { data?: unknown; error?: null | { code?: string } };
function chain(result: Result = { data: null, error: null }) {
  const proxy: Record<string | symbol, unknown> = new Proxy({}, { get: (_target, property) => {
    if (property === "then") return (resolve: (value: Result) => void) => resolve(result);
    if (property === "single" || property === "maybeSingle") return async () => result;
    return () => proxy;
  } });
  return proxy;
}
function client(results: Result[] = [{ data: null, error: null }]) {
  const from = vi.fn(() => chain(results.shift() ?? { data: null, error: null }));
  return { from, auth: { signOut: vi.fn().mockResolvedValue({ error: null }) }, storage: { from: vi.fn(() => ({ upload: vi.fn().mockResolvedValue({ error: null }), remove: vi.fn().mockResolvedValue({ error: null }) })) } };
}
const jsonRequest = (url: string, method: string, body: unknown) => new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("authenticated workflow API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.getCurrentUser.mockResolvedValue({ id: "a55c9dc0-e956-4bf6-953a-8a7b227c1d49", email: "sam@example.com" }); mocks.createAdminClient.mockReturnValue({}); mocks.persistNormalizedJob.mockResolvedValue("fc68f802-16c5-4d23-aa1f-97ae0bfe6400");
  });

  it("persists an editable profile", async () => {
    const database = client(); mocks.createClient.mockResolvedValue(database);
    const response = await saveProfile(jsonRequest("http://localhost/api/profile", "PUT", { fullName: "Sam", currentTitle: "Engineer", location: "Cairo", summary: "Builder", skills: ["TypeScript"], preferredRoles: ["Engineer"], preferredCountries: [], preferredLocations: ["Remote"], employmentTypes: ["Full-time"], workplaceTypes: ["remote"], yearsExperience: 4 }));
    expect(response.status).toBe(200); expect(database.from).toHaveBeenCalledWith("candidate_profiles");
  });

  it("returns ranked recommendations for persisted profile preferences", async () => {
    const database = client([{ data: {
      id: "profile", full_name: "Sam", current_title: "Engineer", location: "Cairo", summary: "Builder",
      skills: [{ name: "TypeScript", source: "user" }], years_experience: 4,
      preferred_roles: ["Frontend Engineer"], preferred_countries: ["Germany"], preferred_locations: ["Berlin"],
      employment_types: ["Full-time"], workplace_types: ["remote"], manual_fields: ["preferences"],
    }, error: null }]);
    mocks.createClient.mockResolvedValue(database);

    const response = await getRecommendations();
    const body = await response.json() as { recommendations: Array<{ job: { title: string } }> };

    expect(response.status).toBe(200);
    expect(body.recommendations.map(({ job }) => job.title)).toContain("Senior Frontend Engineer");
  });

  it("persists and saves a normalized job", async () => {
    const database = client([{ data: { id: "saved", job_id: "fc68f802-16c5-4d23-aa1f-97ae0bfe6400", priority: 0 }, error: null }]); mocks.createClient.mockResolvedValue(database);
    const job = { id: "1", provider: "feed", title: "Engineer", company: "Acme", workplaceType: "remote", skills: ["TypeScript"], sourceUrl: "https://jobs.example/1", status: "ACTIVE", freshnessLabel: "live", firstDiscoveredAt: "2026-08-17T00:00:00.000Z", lastSeenAt: "2026-08-17T00:00:00.000Z" };
    const response = await saveJob(jsonRequest("http://localhost/api/jobs/saved", "POST", { job, priority: 0 }));
    expect(response.status).toBe(201); expect(mocks.persistNormalizedJob).toHaveBeenCalled(); expect(database.from).toHaveBeenCalledWith("saved_jobs");
  });

  it("creates a scheduled saved search", async () => {
    const database = client([{ data: { id: "search", name: "Daily" }, error: null }]); mocks.createClient.mockResolvedValue(database);
    const query = { keywords: ["TypeScript"], roles: [], locations: [], countries: [], employmentTypes: [], workplaceTypes: [], experienceLevels: [], companies: [], excludedCompanies: [], limit: 25 };
    const response = await saveSearch(jsonRequest("http://localhost/api/searches", "POST", { name: "Daily", query, enabled: true, schedule: "daily", minimumMatchScore: 75 }));
    expect(response.status).toBe(201); expect(database.from).toHaveBeenCalledWith("saved_searches");
  });

  it("creates an application and marks notifications read", async () => {
    const applicationDb = client([{ data: { id: "application", stage: "Planning", state: "DISCOVERED" }, error: null }]); mocks.createClient.mockResolvedValue(applicationDb);
    expect((await createApplication(jsonRequest("http://localhost/api/applications", "POST", { jobId: "fc68f802-16c5-4d23-aa1f-97ae0bfe6400", applicationUrl: "https://jobs.example/apply" }))).status).toBe(201);
    const notificationDb = client(); mocks.createClient.mockResolvedValue(notificationDb);
    expect((await markNotification(jsonRequest("http://localhost/api/notifications", "PATCH", { all: true }))).status).toBe(200);
  });

  it("saves bounded automation settings after a recorded simulation", async () => {
    process.env.FEATURE_AUTO_APPLY = "true";
    const database = client([{ data: { simulation_completed_at: "2026-08-17T00:00:00Z" }, error: null }, { data: null, error: null }]); mocks.createClient.mockResolvedValue(database);
    const response = await saveAutomation(jsonRequest("http://localhost/api/settings/automation", "PUT", { enabled: true, minimumMatch: 85, dailyLimit: 10, weeklyLimit: 50, companyDailyLimit: 2, maximumJobAgeHours: 72, companyWhitelist: ["Acme"], companyBlacklist: [] }));
    expect(response.status).toBe(200); delete process.env.FEATURE_AUTO_APPLY;
  });

  it("uploads a signature-validated CV and records metadata", async () => {
    const database = client([{ data: null, error: null }, { data: { id: "cv", original_filename: "cv.pdf", parse_status: "PENDING" }, error: null }]); mocks.createClient.mockResolvedValue(database);
    const form = new FormData(); form.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "cv.pdf", { type: "application/pdf" }));
    const response = await uploadCv(new Request("http://localhost/api/cv/upload", { method: "POST", body: form }));
    expect(response.status).toBe(201); expect(database.storage.from).toHaveBeenCalledWith("cvs"); expect(database.from).toHaveBeenCalledWith("cv_documents");
  });

  it("ends the Supabase session", async () => {
    const database = client(); mocks.createClient.mockResolvedValue(database);
    expect((await logout()).status).toBe(200); expect(database.auth.signOut).toHaveBeenCalledOnce();
  });
});

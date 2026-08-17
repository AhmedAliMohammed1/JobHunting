import { describe, expect, it } from "vitest";
import { GET as getApplications } from "@/app/api/applications/route";
import { GET as getCv } from "@/app/api/cv/route";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { GET as getProfile } from "@/app/api/profile/route";
import { GET as getRecommendations } from "@/app/api/recommendations/route";
import { GET as getSavedJobs } from "@/app/api/jobs/saved/route";
import { GET as getSearches } from "@/app/api/searches/route";
import { GET as getSettings } from "@/app/api/settings/automation/route";
import { GET as getSummary } from "@/app/api/workspace/summary/route";

describe("authenticated API boundaries", () => {
  it.each([
    ["profile", getProfile], ["saved jobs", getSavedJobs], ["saved searches", getSearches], ["applications", getApplications], ["notifications", getNotifications], ["CVs", getCv], ["recommendations", getRecommendations], ["automation settings", getSettings], ["dashboard summary", getSummary],
  ])("rejects anonymous access to %s", async (_name, handler) => {
    const response = await handler();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
});

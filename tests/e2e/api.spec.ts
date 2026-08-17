import { expect, test } from "@playwright/test";

test.describe("runtime API suite", () => {
  test("health and configuration endpoints are explicit", async ({ request }) => {
    const health = await request.get("/api/health"); expect(health.ok()).toBeTruthy(); expect((await health.json()).components.application).toBe("ok");
    const config = await request.get("/api/config/status"); expect(config.ok()).toBeTruthy(); const body = await config.json(); expect(body.services).toHaveProperty("auth"); expect(body.services).toHaveProperty("jobs");
  });

  test("private resource endpoints reject an anonymous caller", async ({ request }) => {
    for (const path of ["/api/profile", "/api/jobs/saved", "/api/searches", "/api/applications", "/api/notifications", "/api/cv", "/api/settings/automation"]) {
      const response = await request.get(path); expect(response.status(), path).toBe(401);
    }
  });
});

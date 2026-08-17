import { expect, test } from "@playwright/test";

test.describe("workspace navigation suite", () => {
  test.skip(process.env.E2E_PRODUCTION_MISCONFIGURED === "true", "Production correctly blocks protected routes when authentication is not configured.");
  test("dashboard exposes every primary workflow and safe defaults", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /next role/i })).toBeVisible();
    await expect(page.getByText(/Auto Apply is off by default/i)).toBeVisible();
    for (const name of ["Discover roles", "saved jobs", "applications", "unread alerts", "profile"]) await expect(page.getByRole("heading", { name: new RegExp(name, "i") }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Application pipeline" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Top recommendations" })).toBeVisible();
    const navigation = page.getByRole("navigation", { name: "Workspace navigation" });
    for (const name of ["Overview", "Discover", "Recommendations", "Saved jobs", "Applications", "Automation", "My profile", "CV documents", "Search profiles", "Notifications", "Settings"]) await expect(navigation.getByRole("link", { name })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
  });

  const routes = [
    ["/saved", "Saved jobs"], ["/applications", "Every application has a paper trail"], ["/recommended", "Matches you can audit"], ["/profile", "Facts you own and can correct"], ["/cv", "Versioned CVs"], ["/search-profiles", "Turn intent into a repeatable search"], ["/notifications", "Useful alerts"], ["/automation", "Prepared, paced, and interruptible"], ["/settings", "Workspace controls"], ["/settings/auto-apply", "Auto-apply has two keys"],
  ];
  for (const [route, heading] of routes) test(`${route} renders its connected feature shell`, async ({ page }) => { await page.goto(route); await expect(page.getByRole("heading", { name: new RegExp(heading, "i") })).toBeVisible(); await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeVisible(); });
  test("sample role details render actual preview facts", async ({ page }) => {
    await page.goto("/jobs/sample-northbeam-ml-engineer");
    await expect(page.getByRole("heading", { name: "Machine Learning Engineer" })).toBeVisible();
    await expect(page.getByText("Northbeam Labs")).toBeVisible();
    await expect(page.getByText("PyTorch")).toBeVisible();
  });
});

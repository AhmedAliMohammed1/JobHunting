import { expect, test } from "@playwright/test";

test.describe("job search suite", () => {
  test.skip(process.env.E2E_PRODUCTION_MISCONFIGURED === "true", "Production correctly blocks protected search when authentication is not configured.");
  test.beforeEach(async ({ page }) => { await page.goto("/search"); });

  test("search returns normalized results and explicit fixture disclosure", async ({ page }) => {
    await page.getByLabel("Search roles").fill("TypeScript engineer");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("DEVELOPMENT FIXTURE").first()).toBeVisible();
    await expect(page.getByText(/not live listings/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /View on/i }).first()).toHaveAttribute("target", "_blank");
  });

  test("natural-language constraints are interpreted instead of discarded", async ({ page }) => {
    await page.getByLabel("Search roles").fill("Find TypeScript engineering jobs in Germany, remote, posted this week");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByLabel("Interpreted search filters")).toContainText("Germany");
    await expect(page.getByLabel("Interpreted search filters")).toContainText("remote");
    await expect(page.getByText("Arc & Field")).toHaveCount(0);
  });

  test("structured filters are keyboard-visible and usable", async ({ page }) => {
    await page.getByLabel("Search roles").fill("engineer");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("DEVELOPMENT FIXTURE").first()).toBeVisible();
    const filtersButton = page.getByRole("button", { name: "Filters" });
    await filtersButton.click();
    await expect(filtersButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByLabel("Locations")).toBeVisible();
    await page.getByLabel("Workplace").selectOption("remote");
    await page.getByLabel("Date posted").selectOption("24");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/roles returned|not live listings|provider/i).first()).toBeVisible();
    await expect(page.getByText("Arc & Field")).toHaveCount(0);
  });

  test("durable save actions enforce authentication", async ({ page }) => {
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: /Save Senior Frontend Engineer/i }).click();
    await expect(page.locator(".control-error")).toContainText(/sign in/i);
    await page.getByRole("button", { name: "Save search" }).click();
    await expect(page.locator(".form-status")).toContainText(/Unauthorized/i);
  });
});

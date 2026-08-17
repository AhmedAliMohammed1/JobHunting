import { expect, test } from "@playwright/test";

test("dashboard exposes safe product navigation", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /next role/i })).toBeVisible();
  await expect(page.getByText(/Auto Apply is off by default/i)).toBeVisible();
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: /Search with intent/i })).toBeVisible();
});

test("mock search is labeled as a development fixture", async ({ page }) => {
  await page.goto("/search");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText("DEVELOPMENT FIXTURE").first()).toBeVisible();
  await expect(page.getByText(/not live listings/i)).toBeVisible();
});

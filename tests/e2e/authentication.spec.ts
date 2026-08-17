import { expect, test } from "@playwright/test";

test.describe("authentication suite", () => {
  test("public home is clearly signed out and routes workspace actions through login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/you are viewing a public product tour/i)).toBeVisible();
    await expect(page.getByText(/you are not signed in/i)).toBeVisible();
    await expect(page.getByText("Personal workspace", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in to search" })).toHaveAttribute("href", "/login?returnTo=%2Fsearch");
  });

  test("a misconfigured production deployment fails closed", async ({ page }) => {
    test.skip(process.env.E2E_PRODUCTION_MISCONFIGURED !== "true", "Only applies to the production preflight run.");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login\?error=configuration/);
    await expect(page.locator(".auth-error")).toContainText(/not configured/i);
  });
  test("login exposes email, password, recovery, registration, and configuration state", async ({ page, request }) => {
    const configuration = await request.get("/api/config/status");
    const { services } = await configuration.json() as { services: { auth: boolean } };
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "8");
    await expect(page.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/forgot-password");
    await expect(page.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/register");
    const setupNotice = page.getByText(/connect Supabase to enable sign-in/i);
    if (services.auth) {
      await expect(setupNotice).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
    } else {
      await expect(setupNotice).toBeVisible();
    }
  });

  test("registration enforces the stronger new-password policy", async ({ page }) => {
    await page.goto("/register");
    await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "12");
    await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  });

  test("password reset routes render the correct forms", async ({ page }) => {
    await page.goto("/forgot-password"); await expect(page.getByRole("button", { name: /send reset link/i })).toBeVisible();
    await page.goto("/reset-password"); await expect(page.getByLabel("New password")).toHaveAttribute("minlength", "12");
  });
});

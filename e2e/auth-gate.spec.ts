import { test, expect } from "@playwright/test";

test.describe("auth gate", () => {
  test("redirects unauthenticated users from dashboard to login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("shows login form on the public login page", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("textbox", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with email" })).toBeVisible();
  });
});

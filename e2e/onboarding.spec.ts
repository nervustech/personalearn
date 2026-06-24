import { test, expect } from "@playwright/test";

const e2eEmail = process.env.E2E_TEST_EMAIL;
const e2ePassword = process.env.E2E_TEST_PASSWORD;

test.describe("onboarding", () => {
  test.skip(
    !e2eEmail || !e2ePassword,
    "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated onboarding E2E"
  );

  test("signs in and creates a class from onboarding", async ({ page }) => {
    const className = `E2E Class ${Date.now()}`;

    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill(e2eEmail!);
    await page.getByLabel("Password").fill(e2ePassword!);
    await page.getByRole("button", { name: "Sign in with email" }).click();

    await page.waitForURL(/\/(onboarding|dashboard)/);

    if (page.url().includes("/onboarding")) {
      await page.getByLabel("Class name").fill(className);
      await page.getByLabel("Subject").fill("Mathematics");
      await page.getByRole("button", { name: "Create class" }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(className)).toBeVisible();
      return;
    }

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

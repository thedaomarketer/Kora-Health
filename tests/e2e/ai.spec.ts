import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test.describe.serial("Kora AI safety and matching", () => {
  test("consent gate, emergency safety response, and conversation persistence", async ({ page }) => {
    await signUp(page, "patient", "AI Tester", uniqueEmail("ai"));
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");

    await page.goto("/patient/ai");
    await expect(page.getByRole("heading", { name: "Before you use Kora AI" })).toBeVisible();
    await page.getByRole("button", { name: /turn on Kora AI/ }).click();
    await expect(page.getByText("How can I help you navigate your care?")).toBeVisible();

    await page.getByLabel("Message Kora AI").fill("I have crushing chest pain and my arm is numb");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Safety information")).toBeVisible();
    await expect(page.getByText(/Call 911/).first()).toBeVisible();
    await page.waitForURL(/\/patient\/ai\/[0-9a-f-]{36}$/);

    await page.reload();
    await expect(page.getByText("Safety information")).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: "I have crushing chest pain" })).toBeVisible();

    await page.getByRole("button", { name: "Delete this conversation" }).click();
    await page.waitForURL("**/patient/ai");
    await expect(page.getByText("I have crushing chest pain")).toHaveCount(0);
  });

  test("find care explains why each provider appears", async ({ page }) => {
    await signUp(page, "patient", "Match Tester", uniqueEmail("match"));
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");
    await page.goto("/patient/find");
    await page.getByLabel("What do you need help with?").fill("I've been feeling anxious and stressed");
    await page.getByLabel("Virtual").check();
    await page.getByRole("button", { name: "Find providers" }).click();
    await expect(page.getByRole("link", { name: "Mental health" }).first()).toBeVisible();
    await expect(page.getByText("Why this provider appears").first()).toBeVisible();
    await expect(page.getByText("Offers virtual appointments.").first()).toBeVisible();
  });

  test("find care routes emergencies to urgent help instead of matching", async ({ page }) => {
    await signUp(page, "patient", "Urgent Tester", uniqueEmail("urgent"));
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");
    await page.goto("/patient/find?go=1&concern=" + encodeURIComponent("I can't breathe and my lips are swelling"));
    await expect(page.getByRole("alert").filter({ hasText: "Please get urgent help" })).toBeVisible();
    await expect(page.getByText("Why this provider appears")).toHaveCount(0);
  });
});

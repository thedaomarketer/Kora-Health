import { expect, test } from "@playwright/test";
import { grantAdminRole, signUp, uniqueEmail } from "./helpers";

test.describe.serial("admin verification workflow", () => {
  const adminEmail = uniqueEmail("admin");

  test("superadmin reviews a verification with the required checklist", async ({ page }) => {
    await signUp(page, "patient", "Kora Verifier", adminEmail);
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");
    await grantAdminRole(adminEmail, "superadmin");

    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Platform overview" })).toBeVisible();
    await expect(page.getByText("System health")).toBeVisible();

    await page.goto("/admin/verifications");
    const first = page.locator("main li a").first();
    const name = (await first.locator("p").first().textContent())?.replace("Sample", "").trim() ?? "";
    await first.click();
    await expect(page.getByText("Submitted credentials")).toBeVisible();

    // Approval without the checklist is rejected by the database.
    await page.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText(/checklist incomplete/i)).toBeVisible();

    for (const label of [/found in the regulator/, /Name on the register/, /License is active/, /Jurisdiction matches/]) {
      await page.getByLabel(label).check();
    }
    await page.getByRole("button", { name: "Record decision" }).click();
    await page.waitForURL("**/admin/verifications?reviewed=1");

    await page.goto(`/providers?q=${encodeURIComponent(name.replace(/^Dr\.\s*/, ""))}`);
    await expect(page.getByText("License verified").first()).toBeVisible();

    await page.goto("/admin/audit?action=admin.");
    await expect(page.getByRole("cell", { name: "admin.verification_approved" }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: "admin.credentials_viewed" }).first()).toBeVisible();
  });

  test("moderator-only pages are forbidden to a verifier", async ({ page }) => {
    const email = uniqueEmail("verifier");
    await signUp(page, "patient", "Only Verifier", email);
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");
    await grantAdminRole(email, "verifier");
    await page.goto("/admin/reports");
    await expect(page).toHaveURL(/\/forbidden$/);
    await page.goto("/admin/verifications");
    await expect(page.getByRole("heading", { name: "Provider verifications" })).toBeVisible();
  });
});

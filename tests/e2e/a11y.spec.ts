import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

async function audit(page: Page, path: string) {
  await page.goto(path);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).exclude("nextjs-portal").analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  expect(summary, `${path} accessibility violations`).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${path} has horizontal scroll`).toBeLessThanOrEqual(1);
}

const PUBLIC = ["/", "/providers", "/providers/amara-okafor-sample", "/ai", "/for-providers", "/pricing", "/about", "/privacy", "/terms", "/security", "/sign-in", "/sign-up", "/forgot-password"];

test.describe("accessibility @mobile", () => {
  for (const path of PUBLIC) {
    test(`public page ${path}`, async ({ page }) => {
      await audit(page, path);
    });
  }

  test("patient app pages", async ({ page }) => {
    await signUp(page, "patient", "A11y Patient", uniqueEmail("a11y"));
    await audit(page, "/onboarding/patient");
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");
    for (const path of ["/patient", "/patient/appointments", "/patient/messages", "/patient/saved", "/patient/health", "/patient/connections", "/patient/resources", "/patient/find?go=1&concern=anxiety", "/patient/ai", "/settings", "/notifications"]) {
      await audit(page, path);
    }
  });

  test("provider app pages", async ({ page }) => {
    await signUp(page, "provider", "A11y Provider", uniqueEmail("a11yprov"));
    await audit(page, "/onboarding/provider");
    await page.getByLabel("Profession").selectOption("physician");
    await page.getByRole("checkbox", { name: "Primary care" }).first().check();
    await page.getByLabel("I offer virtual appointments").check();
    await page.getByLabel("City").fill("Toronto");
    await page.getByLabel("Country").selectOption("CA");
    await page.getByRole("button", { name: "Continue to dashboard" }).click();
    await page.waitForURL("**/provider?welcome=1");
    for (const path of ["/provider", "/provider/appointments", "/provider/messages", "/provider/patients", "/provider/profile", "/provider/practice", "/provider/availability", "/provider/verification", "/provider/analytics", "/provider/billing"]) {
      await audit(page, path);
    }
  });
});

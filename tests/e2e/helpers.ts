import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Correct-Horse-9-Battery";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

export async function signUp(page: Page, role: "patient" | "provider", name: string, email: string) {
  await page.goto(`/sign-up${role === "provider" ? "?role=provider" : ""}`);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel(/I agree/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(`**/onboarding/${role}`);
}

export async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(patient|provider)/);
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("/");
}

export async function expectNoA11yBasics(page: Page) {
  // Every page must have exactly one h1 and a main landmark.
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator("main#main")).toHaveCount(1);
}

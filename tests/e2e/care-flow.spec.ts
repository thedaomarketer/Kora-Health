import { expect, test } from "@playwright/test";
import { expectNoA11yBasics, signIn, signOut, signUp, uniqueEmail } from "./helpers";

test.describe.serial("two-sided care flow", () => {
  const providerEmail = uniqueEmail("provider");
  const patientEmail = uniqueEmail("patient");
  const providerName = `Adaeze Test ${Date.now() % 100000}`;
  let profilePath = "";

  test("provider onboards, adds practice details and submits verification", async ({ page }) => {
    await signUp(page, "provider", providerName, providerEmail);
    await page.getByLabel("Title").selectOption("Dr.");
    await page.getByLabel("Profession").selectOption("physician");
    await page.getByRole("checkbox", { name: "Primary care" }).first().check();
    await page.getByLabel("I offer virtual appointments").check();
    await page.getByLabel("City").fill("Toronto");
    await page.getByLabel("Country").selectOption("CA");
    await page.getByRole("button", { name: "Continue to dashboard" }).click();
    await page.waitForURL("**/provider?welcome=1");
    await expect(page.getByText("Get ready to receive requests")).toBeVisible();

    // Service
    await page.goto("/provider/practice");
    await page.getByLabel("Service name").last().fill("Consultation");
    await page.getByRole("button", { name: "Add service" }).click();
    await expect(page.getByText("Service saved.")).toBeVisible();

    // Availability: weekdays 09:00–17:00 (defaults)
    await page.goto("/provider/availability");
    await page.getByLabel("Time zone").selectOption("America/Toronto");
    await page.getByRole("button", { name: "Add hours" }).click();
    await expect(page.getByText("Availability added.")).toBeVisible();

    // Not listed yet: unpublished and unverified
    await page.goto("/provider/profile");
    await expect(page.getByText("Not visible")).toBeVisible();

    // Credential + verification
    await page.goto("/provider/verification");
    await page.getByLabel("Issuing regulator or body").fill("College of Physicians and Surgeons of Ontario");
    await page.getByLabel("Jurisdiction").fill("Ontario, Canada");
    await page.getByLabel("License / registration number").fill("E2E-12345");
    await page.getByRole("button", { name: "Add credential" }).click();
    await expect(page.getByText("Credential added.")).toBeVisible();
    await page.getByRole("button", { name: "Submit for verification" }).click();
    await expect(page.getByText(/Submitted\. Kora will review/)).toBeVisible();
    await expect(page.getByText("Verification pending").first()).toBeVisible();
    await expect(page.getByText("Awaiting review")).toBeVisible();

    // Publish
    await page.goto("/provider/profile");
    await page.getByRole("button", { name: "Publish profile" }).click();
    await expect(page.getByText("Your profile is published.")).toBeVisible();
    const preview = page.getByRole("link", { name: "Preview" });
    profilePath = (await preview.getAttribute("href")) ?? "";
    expect(profilePath).toMatch(/^\/providers\//);
    await signOut(page);
  });

  test("public directory lists the provider as pending, never verified", async ({ page }) => {
    await page.goto(`/providers?q=${encodeURIComponent(providerName)}`);
    await expect(page.getByRole("heading", { name: /1 provider/ })).toBeVisible();
    await page.goto(profilePath);
    await expectNoA11yBasics(page);
    await expect(page.getByText("Verification pending").first()).toBeVisible();
    await expect(page.getByText("License verified")).toHaveCount(0);
  });

  test("patient signs up and requests an appointment", async ({ page }) => {
    await signUp(page, "patient", "Kemi Patient", patientEmail);
    await page.getByLabel("City", { exact: true }).fill("Toronto");
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");
    await page.goto(profilePath);
    await page.getByRole("button", { name: "Save provider" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await page.getByRole("link", { name: "Request appointment" }).click();
    await page.locator('label:has(input[name="slot"])').first().click();
    await page.getByLabel("Note for the provider (optional)").fill("Annual checkup");
    await page.getByLabel(/I understand/).check();
    await page.getByRole("button", { name: "Send request" }).click();
    await page.waitForURL("**/patient/appointments?requested=1");
    await expect(page.getByText("Awaiting provider")).toBeVisible();
    await signOut(page);
  });

  test("provider confirms and messages the patient", async ({ page }) => {
    await signIn(page, providerEmail);
    await page.goto("/provider/appointments");
    await expect(page.getByText("Annual checkup")).toBeVisible();
    await page.getByLabel("Video visit link (optional)").fill("https://meet.example.com/e2e");
    await page.getByRole("button", { name: "Confirm appointment" }).click();
    await expect(page.getByText(/Appointment confirmed\. The patient/)).toBeVisible();
    await page.getByRole("button", { name: "Message" }).first().click();
    await page.waitForURL(/\/provider\/messages\/.+/);
    await page.getByLabel("Message", { exact: true }).fill("Looking forward to seeing you.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Looking forward to seeing you.")).toBeVisible();
    await signOut(page);
  });

  test("patient sees the confirmation, notification and message", async ({ page }) => {
    await signIn(page, patientEmail);
    await page.goto("/patient/appointments");
    await expect(page.getByText("Confirmed").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Join virtual visit/ })).toHaveAttribute("href", "https://meet.example.com/e2e");
    await page.goto("/notifications");
    await expect(page.getByText("Appointment confirmed")).toBeVisible();
    await expect(page.getByText("New message")).toBeVisible();
    await page.goto("/patient/messages");
    await page.getByRole("link", { name: /Looking forward/ }).click();
    await expect(page.getByText("Looking forward to seeing you.")).toBeVisible();
    await page.getByLabel("Message", { exact: true }).fill("Thank you!");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Thank you!")).toBeVisible();
  });
});

test.describe("authorization boundaries", () => {
  test("signed-out users are redirected from app areas", async ({ page }) => {
    for (const path of ["/patient", "/provider", "/admin", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/sign-in\?next=/);
    }
  });

  test("patients cannot open provider or admin areas", async ({ page }) => {
    const email = uniqueEmail("boundary");
    await signUp(page, "patient", "Boundary Patient", email);
    await page.getByRole("button", { name: "Finish setup" }).click();
    await page.waitForURL("**/patient?welcome=1");
    await page.goto("/provider");
    await expect(page).toHaveURL(/\/patient$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});

import type { Metadata } from "next";
import { PatientProfileForm } from "@/components/forms/profile-forms";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getReferenceData } from "@/lib/directory";
import { getPatientProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "Set up your account" };

export default async function PatientOnboarding() {
  const user = await requireUser({ role: "patient", next: "/onboarding/patient" });
  const [profile, reference] = await Promise.all([getPatientProfile(user), getReferenceData()]);
  if (!profile) throw new Error("Patient profile missing");
  return (
    <>
      <p className="text-sm font-semibold text-brand-700">Welcome to Kora</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Let&apos;s personalize your experience</h1>
      <p className="mt-2 max-w-2xl text-muted">Everything here is optional except your name and language. Only you can see your preferences.</p>
      <Card className="mt-8 p-6 sm:p-8">
        <PatientProfileForm profile={profile} reference={reference} mode="onboarding" />
      </Card>
    </>
  );
}

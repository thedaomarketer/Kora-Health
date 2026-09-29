import type { Metadata } from "next";
import { ProviderProfileForm } from "@/components/forms/profile-forms";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getReferenceData } from "@/lib/directory";
import { getOwnProviderProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "Set up your provider profile" };

export default async function ProviderOnboarding() {
  const user = await requireUser({ role: "provider", next: "/onboarding/provider" });
  const [profile, reference] = await Promise.all([getOwnProviderProfile(user), getReferenceData()]);
  return (
    <>
      <p className="text-sm font-semibold text-brand-700">Provider setup · Step 1 of 4</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Create your professional profile</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Next you&apos;ll add services and availability, submit your license for verification, and publish your profile.
        Your profile stays private until you publish it.
      </p>
      <Card className="mt-8 p-6 sm:p-8">
        <ProviderProfileForm profile={profile} reference={reference} mode="onboarding" defaultName={user.displayName} />
      </Card>
    </>
  );
}

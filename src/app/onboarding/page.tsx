import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

/** Routes a signed-in user to the right onboarding step or dashboard. */
export default async function OnboardingIndex() {
  const user = await requireUser({ next: "/onboarding" });
  const done = await asUser(user, async (q) => {
    const sql =
      user.role === "patient"
        ? `select onboarding_completed_at is not null as done from public.patient_profiles where user_id = auth.uid()`
        : `select onboarding_completed_at is not null as done from public.provider_profiles where user_id = auth.uid()`;
    return (await q<{ done: boolean }>(sql))[0]?.done ?? false;
  });
  if (user.role === "patient") redirect(done ? "/patient" : "/onboarding/patient");
  redirect(done ? "/provider" : "/onboarding/provider");
}

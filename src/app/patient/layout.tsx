import { redirect } from "next/navigation";
import { AppShell, PATIENT_NAV } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ role: "patient", next: "/patient" });
  const [row] = await asUser(user, (q) =>
    q<{ done: boolean }>(`select onboarding_completed_at is not null as done from public.patient_profiles where user_id = auth.uid()`),
  );
  if (!row?.done) redirect("/onboarding/patient");
  return (
    <AppShell user={user} nav={PATIENT_NAV} area="Patient">
      {children}
    </AppShell>
  );
}

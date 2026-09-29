import { redirect } from "next/navigation";
import { AppShell, PROVIDER_NAV } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ role: "provider", next: "/provider" });
  const [row] = await asUser(user, (q) =>
    q<{ done: boolean }>(`select onboarding_completed_at is not null as done from public.provider_profiles where user_id = auth.uid()`),
  );
  if (!row?.done) redirect("/onboarding/provider");
  return (
    <AppShell user={user} nav={PROVIDER_NAV} area="Provider">
      {children}
    </AppShell>
  );
}

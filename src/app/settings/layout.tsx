import { AppShell, navFor } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ next: "/settings" });
  return (
    <AppShell user={user} nav={navFor(user)} area={user.role === "provider" ? "Provider" : "Patient"}>
      {children}
    </AppShell>
  );
}

import { AppShell, navFor } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/session";

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ next: "/notifications" });
  return (
    <AppShell user={user} nav={navFor(user)} area={user.role === "provider" ? "Provider" : "Patient"}>
      {children}
    </AppShell>
  );
}

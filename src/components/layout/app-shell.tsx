import Link from "next/link";
import { Bell, LogOut, Settings } from "lucide-react";
import { KoraLogo } from "@/components/brand/logo";
import { signOutAction } from "@/app/(site)/(auth)/actions";
import { hasAdminRole, type SessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";
import { AppNav, type NavItem } from "./app-nav";

export const PATIENT_NAV: NavItem[] = [
  { href: "/patient", label: "Overview", icon: "home" },
  { href: "/patient/ai", label: "Kora AI", icon: "sparkles" },
  { href: "/patient/find", label: "Find care", icon: "search" },
  { href: "/patient/appointments", label: "Appointments", icon: "calendar" },
  { href: "/patient/messages", label: "Messages", icon: "messages" },
  { href: "/patient/saved", label: "Saved providers", icon: "bookmark" },
  { href: "/patient/health", label: "Health information", icon: "heart" },
  { href: "/patient/connections", label: "Connected apps", icon: "link" },
  { href: "/patient/resources", label: "Resources", icon: "book" },
];

export const PROVIDER_NAV: NavItem[] = [
  { href: "/provider", label: "Overview", icon: "home" },
  { href: "/provider/appointments", label: "Appointments", icon: "calendar" },
  { href: "/provider/messages", label: "Messages", icon: "messages" },
  { href: "/provider/patients", label: "Patients", icon: "users" },
  { href: "/provider/profile", label: "Profile", icon: "user" },
  { href: "/provider/practice", label: "Services & locations", icon: "building" },
  { href: "/provider/availability", label: "Availability", icon: "clock" },
  { href: "/provider/verification", label: "Verification", icon: "shield" },
  { href: "/provider/analytics", label: "Analytics", icon: "chart" },
  { href: "/provider/billing", label: "Plan & billing", icon: "card" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "chart" },
  { href: "/admin/verifications", label: "Verifications", icon: "shield" },
  { href: "/admin/reports", label: "Reports", icon: "flag" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/ai-safety", label: "AI safety", icon: "sparkles" },
  { href: "/admin/integrations", label: "Integrations", icon: "link" },
  { href: "/admin/audit", label: "Audit log", icon: "list" },
  { href: "/admin/admins", label: "Administrators", icon: "key" },
];

export function navFor(user: SessionUser) {
  return user.role === "provider" ? PROVIDER_NAV : PATIENT_NAV;
}

export async function AppShell({ user, nav, children, area }: { user: SessionUser; nav: NavItem[]; children: React.ReactNode; area: string }) {
  const [{ unread }] = await asUser(user, (q) =>
    q<{ unread: number }>(`select count(*)::int as unread from public.notifications where user_id = auth.uid() and read_at is null`),
  );
  const isAdmin = hasAdminRole(user);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-white/90 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" aria-label="Kora Health home" className="rounded-lg">
              <KoraLogo />
            </Link>
            <span className="hidden rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-800 sm:inline">{area}</span>
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && area !== "Admin" ? (
              <Link href="/admin" className="hidden rounded-full px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:inline">
                Admin
              </Link>
            ) : null}
            {area === "Admin" ? (
              <Link href={user.role === "provider" ? "/provider" : "/patient"} className="hidden rounded-full px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 sm:inline">
                My account
              </Link>
            ) : null}
            <Link href="/notifications" className="relative grid size-11 place-items-center rounded-full text-ink hover:bg-brand-50">
              <Bell aria-hidden className="size-5" />
              <span className="sr-only">Notifications{unread ? ` (${unread} unread)` : ""}</span>
              {unread ? (
                <span aria-hidden className="absolute right-1.5 top-1.5 grid min-w-5 place-items-center rounded-full bg-clay-600 px-1 text-[0.7rem] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <Link href="/settings" className="grid size-11 place-items-center rounded-full text-ink hover:bg-brand-50">
              <Settings aria-hidden className="size-5" />
              <span className="sr-only">Settings</span>
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="grid size-11 place-items-center rounded-full text-ink hover:bg-brand-50">
                <LogOut aria-hidden className="size-5" />
                <span className="sr-only">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <AppNav items={nav} userName={user.displayName || user.email} />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

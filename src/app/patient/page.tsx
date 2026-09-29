import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, Bookmark, CalendarDays, HeartPulse, Link2, MessagesSquare, Search, Sparkles } from "lucide-react";
import { AppointmentItem } from "@/components/care/appointment-items";
import { Alert, EmptyState } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { listAppointments } from "@/lib/care";
import { asUser } from "@/lib/db";
import { formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Your dashboard" };

export default async function PatientDashboard({ searchParams }: PageProps<"/patient">) {
  const user = await requireUser({ role: "patient" });
  const sp = await searchParams;
  const [upcoming, stats, notifications, saved] = await Promise.all([
    listAppointments(user, "upcoming", 3),
    asUser(user, async (q) => (await q<{ pending: number; unread: number; health: number; connections: number; ai: number }>(
      `select (select count(*)::int from public.appointment_requests where patient_id = auth.uid() and status = 'pending') as pending,
              (select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id
                where c.patient_id = auth.uid() and m.sender_id <> auth.uid() and m.read_at is null) as unread,
              (select count(*)::int from public.health_data where patient_id = auth.uid()) as health,
              (select count(*)::int from public.integration_connections where user_id = auth.uid() and status = 'active') as connections,
              (select count(*)::int from public.ai_conversations where user_id = auth.uid()) as ai`,
    ))[0]),
    asUser(user, (q) => q<{ id: string; title: string; body: string | null; link: string | null; created_at: string; read_at: string | null }>(
      `select id, title, body, link, created_at, read_at from public.notifications where user_id = auth.uid() order by created_at desc limit 5`,
    )),
    asUser(user, (q) => q<{ slug: string; name: string; profession: string | null }>(
      `select p.slug, concat_ws(' ', p.honorific, p.display_name) as name, pr.name as profession
         from public.saved_providers s join public.provider_profiles p on p.id = s.provider_id
         left join public.professions pr on pr.id = p.profession_id
        where s.patient_id = auth.uid() order by s.created_at desc limit 4`,
    )),
  ]);
  const firstName = user.displayName.split(" ")[0] || "there";

  return (
    <div className="space-y-8">
      {sp.welcome ? (
        <Alert tone="success" title="You're all set">
          Your account is ready. Search for a provider, or ask Kora AI to help you figure out where to start.
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Hello, {firstName}</h1>
          <p className="mt-1 text-muted">Here&apos;s what&apos;s happening with your care.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/providers" variant="secondary"><Search aria-hidden className="size-4" /> Find a provider</ButtonLink>
          <ButtonLink href="/patient/ai"><Sparkles aria-hidden className="size-4" /> Ask Kora AI</ButtonLink>
        </div>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/patient/appointments", Icon: CalendarDays, label: "Upcoming appointments", value: upcoming.length, sub: stats.pending ? `${stats.pending} request${stats.pending === 1 ? "" : "s"} pending` : "No pending requests" },
          { href: "/patient/messages", Icon: MessagesSquare, label: "Unread messages", value: stats.unread, sub: "Secure messaging" },
          { href: "/patient/health", Icon: HeartPulse, label: "Health entries", value: stats.health, sub: "Private to you" },
          { href: "/patient/connections", Icon: Link2, label: "Connected apps", value: stats.connections, sub: "Integrations coming soon" },
        ].map(({ href, Icon, label, value, sub }) => (
          <li key={href}>
            <Link href={href} className="block rounded-3xl bg-white p-5 ring-1 ring-line/80 transition hover:shadow-[var(--shadow-card)] hover:ring-brand-200">
              <Icon aria-hidden className="size-5 text-brand-700" />
              <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
              <p className="text-sm font-medium text-ink">{label}</p>
              <p className="mt-0.5 text-xs text-muted">{sub}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Upcoming appointments" action={<Link href="/patient/appointments" className="text-sm font-semibold text-brand-700 hover:underline">View all</Link>} />
          <CardBody>
            {upcoming.length ? (
              <ul className="space-y-3">{upcoming.map((a) => <AppointmentItem key={a.id} a={a} viewer="patient" />)}</ul>
            ) : (
              <EmptyState icon={<CalendarDays aria-hidden className="size-6" />} title="No upcoming appointments" description="When a provider confirms a request, it will appear here." action={<ButtonLink href="/providers" size="sm">Find a provider</ButtonLink>} />
            )}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="bg-brand-800 p-6 text-white">
              <Sparkles aria-hidden className="size-6 text-clay-200" />
              <h2 className="mt-3 text-lg font-semibold">Not sure where to start?</h2>
              <p className="mt-1 text-sm text-brand-100">Kora AI can help you organize your concerns and find the right type of professional. It doesn&apos;t diagnose.</p>
              <ButtonLink href="/patient/ai" variant="inverse" size="sm" className="mt-4">Talk to Kora AI <ArrowRight aria-hidden className="size-4" /></ButtonLink>
            </div>
          </Card>
          <Card>
            <CardHeader title="Notifications" action={<Link href="/notifications" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
            <CardBody>
              {notifications.length ? (
                <ul className="space-y-3">
                  {notifications.map((n) => (
                    <li key={n.id} className="flex gap-3">
                      <Bell aria-hidden className={n.read_at ? "mt-0.5 size-4 text-stone-400" : "mt-0.5 size-4 text-clay-600"} />
                      <div className="min-w-0">
                        {n.link ? <Link href={n.link} className="text-sm font-semibold text-ink hover:underline">{n.title}</Link> : <p className="text-sm font-semibold text-ink">{n.title}</p>}
                        <p className="text-xs text-muted">{formatRelative(n.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">You&apos;re all caught up.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Saved providers" action={<Link href="/patient/saved" className="text-sm font-semibold text-brand-700 hover:underline">All</Link>} />
            <CardBody>
              {saved.length ? (
                <ul className="space-y-2">
                  {saved.map((s) => (
                    <li key={s.slug}>
                      <Link href={`/providers/${s.slug}`} className="flex items-center gap-2 text-sm font-medium text-ink hover:text-brand-700">
                        <Bookmark aria-hidden className="size-4 text-brand-700" /> {s.name}
                        <span className="text-muted">· {s.profession}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">Save providers from their profiles to find them quickly.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

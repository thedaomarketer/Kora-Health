import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Circle, Eye, Inbox, MessagesSquare, Users } from "lucide-react";
import { AppointmentItem } from "@/components/care/appointment-items";
import { Alert, EmptyState } from "@/components/ui/alert";
import { VerificationBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { listAppointments, listRequests } from "@/lib/care";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getOwnProviderProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "Provider dashboard" };

interface Stats { pending_requests: number; upcoming_appointments: number; patients: number; unread_messages: number }

export default async function ProviderDashboard({ searchParams }: PageProps<"/provider">) {
  const user = await requireUser({ role: "provider" });
  const sp = await searchParams;
  const [profile, stats, pending, upcoming, credentialCount] = await Promise.all([
    getOwnProviderProfile(user),
    asUser(user, async (q) => (await q<{ s: Stats }>(`select public.provider_stats() as s`))[0].s),
    listRequests(user, "pending", 5),
    listAppointments(user, "upcoming", 5),
    asUser(user, async (q) => (await q<{ n: number }>(`select count(*)::int as n from public.provider_credentials where provider_id = public.current_provider_id()`))[0].n),
  ]);
  if (!profile) return null;

  const checklist = [
    { done: true, label: "Create your profile", href: "/provider/profile" },
    { done: profile.service_list.length > 0, label: "Add services", href: "/provider/practice" },
    { done: profile.weekly_hours.length > 0, label: "Set weekly availability", href: "/provider/availability" },
    { done: credentialCount > 0, label: "Add your license", href: "/provider/verification" },
    { done: ["pending", "verified"].includes(profile.verification_status), label: "Submit for verification", href: "/provider/verification" },
    { done: profile.is_published, label: "Publish your profile", href: "/provider/profile" },
  ];
  const complete = checklist.every((c) => c.done);

  return (
    <div className="space-y-8">
      {sp.welcome ? <Alert tone="success" title="Profile created">Finish the steps below to appear in the Kora directory.</Alert> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Welcome, {profile.honorific ? `${profile.honorific} ` : ""}{profile.display_name.split(" ").slice(-1)[0]}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            <VerificationBadge status={profile.verification_status} verifiedAt={profile.verified_at} />
            <span>{profile.is_published ? "Published in directory" : "Not published"}</span>
          </div>
        </div>
        <ButtonLink href={`/providers/${profile.slug}`} variant="secondary"><Eye aria-hidden className="size-4" /> View public profile</ButtonLink>
      </div>

      {!complete ? (
        <Card>
          <CardHeader title="Get ready to receive requests" description={`${checklist.filter((c) => c.done).length} of ${checklist.length} steps complete`} />
          <CardBody>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link href={c.href} className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-line hover:bg-brand-50">
                    {c.done ? <CheckCircle2 aria-hidden className="size-5 text-emerald-600" /> : <Circle aria-hidden className="size-5 text-stone-400" />}
                    <span className={c.done ? "text-muted line-through" : "font-medium text-ink"}>{c.label}</span>
                    <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/provider/appointments", Icon: Inbox, label: "Pending requests", value: stats.pending_requests },
          { href: "/provider/appointments", Icon: CalendarClock, label: "Upcoming appointments", value: stats.upcoming_appointments },
          { href: "/provider/messages", Icon: MessagesSquare, label: "Unread messages", value: stats.unread_messages },
          { href: "/provider/patients", Icon: Users, label: "Patients", value: stats.patients },
        ].map(({ href, Icon, label, value }) => (
          <li key={label}>
            <Link href={href} className="block rounded-3xl bg-white p-5 ring-1 ring-line/80 hover:ring-brand-200">
              <Icon aria-hidden className="size-5 text-brand-700" />
              <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
              <p className="text-sm font-medium text-ink">{label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Requests awaiting response" action={<Link href="/provider/appointments" className="text-sm font-semibold text-brand-700 hover:underline">Respond</Link>} />
          <CardBody>
            {pending.length ? (
              <ul className="divide-y divide-line">
                {pending.map((r) => (
                  <li key={r.id} className="py-3">
                    <p className="font-medium text-ink">{r.patient_display_name}</p>
                    <p className="text-sm text-muted">{formatDateTime(r.requested_start, r.timezone ?? undefined)} · {r.modality === "virtual" ? "Virtual" : "In person"}{r.service_name ? ` · ${r.service_name}` : ""}</p>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No pending requests" description="New appointment requests will appear here." />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Upcoming appointments" />
          <CardBody>
            {upcoming.length ? <ul className="space-y-3">{upcoming.map((a) => <AppointmentItem key={a.id} a={a} viewer="provider" />)}</ul> : <EmptyState title="No upcoming appointments" />}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { AppointmentItem, PatientRequestItem } from "@/components/care/appointment-items";
import { Alert, EmptyState } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { listAppointments, listRequests } from "@/lib/care";

export const metadata: Metadata = { title: "Appointments" };

export default async function PatientAppointments({ searchParams }: PageProps<"/patient/appointments">) {
  const user = await requireUser({ role: "patient" });
  const sp = await searchParams;
  const [upcoming, pending, past, recent] = await Promise.all([
    listAppointments(user, "upcoming"),
    listRequests(user, "pending"),
    listAppointments(user, "past", 20),
    listRequests(user, "recent", 20),
  ]);
  return (
    <>
      <PageHeader title="Appointments" description="Requests you've sent and appointments providers have confirmed." actions={<ButtonLink href="/providers">Request an appointment</ButtonLink>} />
      {sp.requested ? (
        <Alert tone="success" title="Request sent" className="mb-6">
          The provider will confirm or decline your request. You&apos;ll get a notification in Kora.
        </Alert>
      ) : null}
      <div className="space-y-10">
        <section aria-labelledby="up">
          <h2 id="up" className="mb-3 text-lg font-semibold text-ink">Upcoming</h2>
          {upcoming.length ? <ul className="space-y-3">{upcoming.map((a) => <AppointmentItem key={a.id} a={a} viewer="patient" />)}</ul> : (
            <EmptyState icon={<CalendarDays aria-hidden className="size-6" />} title="No confirmed appointments" description="Confirmed appointments will appear here." />
          )}
        </section>
        <section aria-labelledby="pend">
          <h2 id="pend" className="mb-3 text-lg font-semibold text-ink">Pending requests</h2>
          {pending.length ? <ul className="space-y-3">{pending.map((r) => <PatientRequestItem key={r.id} r={r} />)}</ul> : <p className="text-sm text-muted">No pending requests.</p>}
        </section>
        {recent.length ? (
          <section aria-labelledby="rec">
            <h2 id="rec" className="mb-3 text-lg font-semibold text-ink">Recent request updates</h2>
            <ul className="space-y-3">{recent.map((r) => <PatientRequestItem key={r.id} r={r} />)}</ul>
          </section>
        ) : null}
        {past.length ? (
          <section aria-labelledby="past">
            <h2 id="past" className="mb-3 text-lg font-semibold text-ink">Past & cancelled</h2>
            <ul className="space-y-3">{past.map((a) => <AppointmentItem key={a.id} a={a} viewer="patient" />)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

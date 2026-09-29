import type { Metadata } from "next";
import { Inbox } from "lucide-react";
import { AppointmentItem } from "@/components/care/appointment-items";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Alert, EmptyState } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, PageHeader } from "@/components/ui/card";
import { SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { requireUser } from "@/lib/auth/session";
import { listAppointments, listRequests, REQUEST_STATUS_LABEL } from "@/lib/care";
import { asUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { respondToRequestAction, updateAppointmentAction } from "../actions";

export const metadata: Metadata = { title: "Appointments" };

export default async function ProviderAppointments({ searchParams }: PageProps<"/provider/appointments">) {
  const user = await requireUser({ role: "provider" });
  const { updated } = await searchParams;
  const [pending, upcoming, past, recent, locations] = await Promise.all([
    listRequests(user, "pending"),
    listAppointments(user, "upcoming"),
    listAppointments(user, "past", 30),
    listRequests(user, "recent", 20),
    asUser(user, (q) => q<{ id: string; label: string | null; city: string }>(`select id, label, city from public.locations where provider_id = public.current_provider_id()`)),
  ]);
  const needsOutcome = past.filter((a) => a.status === "confirmed");

  return (
    <>
      <PageHeader title="Appointments" description="Respond to requests and manage your Kora appointments." />
      {updated === "confirmed" ? <Alert tone="success" role="status" className="mb-6">Appointment confirmed. The patient has been notified.</Alert> : null}
      {updated === "declined" ? <Alert tone="info" role="status" className="mb-6">Request declined. The patient has been notified.</Alert> : null}
      <div className="space-y-10">
        <section aria-labelledby="req">
          <h2 id="req" className="mb-3 text-lg font-semibold text-ink">Requests awaiting response ({pending.length})</h2>
          {pending.length ? (
            <ul className="space-y-4">
              {pending.map((r) => (
                <li key={r.id}>
                  <Card className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{r.patient_display_name}</p>
                        <p className="text-sm text-muted">
                          {formatDateTime(r.requested_start, r.timezone ?? undefined)} · {r.modality === "virtual" ? "Virtual" : "In person"}
                          {r.service_name ? ` · ${r.service_name}` : ""}
                        </p>
                      </div>
                      {r.reschedule_of ? <Badge tone="info">Reschedule request</Badge> : <Badge tone="warning">New request</Badge>}
                    </div>
                    {r.patient_note ? <p className="mt-3 rounded-xl bg-canvas p-3 text-sm"><span className="font-semibold">Patient note: </span>{r.patient_note}</p> : null}
                    <ActionForm action={respondToRequestAction} className="mt-4 space-y-4">
                      <input type="hidden" name="requestId" value={r.id} />
                      <div className="grid gap-4 md:grid-cols-2">
                        {r.modality === "virtual" ? (
                          <TextField label="Video visit link (optional)" name="visitUrl" type="url" placeholder="https://…" hint="Your own telehealth link. You can add it later." />
                        ) : (
                          <SelectField label="Location" name="locationId" defaultValue={locations[0]?.id ?? ""}>
                            <option value="">Not specified</option>
                            {locations.map((l) => <option key={l.id} value={l.id}>{l.label ?? l.city}</option>)}
                          </SelectField>
                        )}
                        <TextAreaField label="Message to patient (optional)" name="message" rows={2} maxLength={1000} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton name="decision" value="accept" pendingLabel="Saving…">Confirm appointment</SubmitButton>
                        <SubmitButton name="decision" value="decline" variant="secondary" pendingLabel="Saving…">Decline</SubmitButton>
                      </div>
                    </ActionForm>
                  </Card>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<Inbox aria-hidden className="size-6" />} title="No pending requests" />}
        </section>

        <section aria-labelledby="up">
          <h2 id="up" className="mb-3 text-lg font-semibold text-ink">Upcoming ({upcoming.length})</h2>
          {upcoming.length ? (
            <ul className="space-y-3">
              {upcoming.map((a) => (
                <div key={a.id}>
                  <AppointmentItem a={a} viewer="provider" />
                  {a.modality === "virtual" ? (
                    <details className="ml-5 mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-700">Update visit link or instructions</summary>
                      <ActionForm action={updateAppointmentAction} className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                        <input type="hidden" name="appointmentId" value={a.id} />
                        <input type="hidden" name="status" value="" />
                        <TextField label="Video visit link" name="visitUrl" type="url" defaultValue={a.virtual_visit_url ?? ""} />
                        <TextField label="Instructions" name="instructions" defaultValue={a.provider_instructions ?? ""} />
                        <SubmitButton size="sm">Save</SubmitButton>
                      </ActionForm>
                    </details>
                  ) : null}
                </div>
              ))}
            </ul>
          ) : <EmptyState title="No upcoming appointments" />}
        </section>

        {needsOutcome.length ? (
          <section aria-labelledby="outcome">
            <h2 id="outcome" className="mb-3 text-lg font-semibold text-ink">Record outcome</h2>
            <ul className="space-y-3">
              {needsOutcome.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-line/80">
                  <span className="text-sm"><strong>{a.patient_display_name}</strong> · {formatDateTime(a.starts_at, a.timezone ?? undefined)}</span>
                  <div className="flex gap-2">
                    {(["completed", "no_show"] as const).map((s) => (
                      <ActionForm key={s} action={updateAppointmentAction}>
                        <input type="hidden" name="appointmentId" value={a.id} />
                        <input type="hidden" name="status" value={s} />
                        <SubmitButton size="sm" variant={s === "completed" ? "primary" : "secondary"}>{s === "completed" ? "Mark completed" : "Mark missed"}</SubmitButton>
                      </ActionForm>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {recent.length ? (
          <section aria-labelledby="recent">
            <h2 id="recent" className="mb-3 text-lg font-semibold text-ink">Recent requests</h2>
            <ul className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line/80">
              {recent.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <span><strong>{r.patient_display_name}</strong> · {formatDateTime(r.requested_start, r.timezone ?? undefined)}</span>
                  <Badge>{REQUEST_STATUS_LABEL[r.status]}</Badge>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {past.filter((a) => a.status !== "confirmed").length ? (
          <section aria-labelledby="past">
            <h2 id="past" className="mb-3 text-lg font-semibold text-ink">Past & cancelled</h2>
            <ul className="space-y-3">{past.filter((a) => a.status !== "confirmed").map((a) => <AppointmentItem key={a.id} a={a} viewer="provider" />)}</ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

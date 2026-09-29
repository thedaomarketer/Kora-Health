import Link from "next/link";
import { Building2, CalendarClock, ExternalLink, MessageSquare, Monitor } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { APPOINTMENT_STATUS_LABEL, REQUEST_STATUS_LABEL, type AppointmentRow, type RequestRow } from "@/lib/care";
import { formatDateTime } from "@/lib/format";
import { cancelAppointmentAction, startConversationAction, withdrawRequestAction } from "@/app/patient/actions";

const statusTone = {
  confirmed: "success",
  completed: "brand",
  cancelled_by_patient: "neutral",
  cancelled_by_provider: "warning",
  rescheduled: "neutral",
  no_show: "warning",
  pending: "warning",
  accepted: "success",
  declined: "danger",
  withdrawn: "neutral",
  expired: "neutral",
} as const;

export function AppointmentItem({ a, viewer }: { a: AppointmentRow; viewer: "patient" | "provider" }) {
  const upcoming = a.status === "confirmed" && new Date(a.ends_at) > new Date();
  const counterpart = viewer === "patient" ? a.provider_name : a.patient_display_name;
  return (
    <li className="rounded-2xl bg-white p-5 ring-1 ring-line/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <CalendarClock aria-hidden className="size-4 text-brand-700" />
            {formatDateTime(a.starts_at, a.timezone ?? undefined)}
          </p>
          <p className="mt-1 text-sm text-ink/85">
            {viewer === "patient" ? (
              <Link href={`/providers/${a.provider_slug}`} className="font-medium text-brand-700 hover:underline">{counterpart}</Link>
            ) : (
              <span className="font-medium">{counterpart}</span>
            )}
            {a.service_name ? ` · ${a.service_name}` : ""}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            {a.modality === "virtual" ? <Monitor aria-hidden className="size-4" /> : <Building2 aria-hidden className="size-4" />}
            {a.modality === "virtual" ? "Virtual visit" : a.location ?? "In person"}
          </p>
        </div>
        <Badge tone={statusTone[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
      </div>
      {a.provider_instructions ? (
        <p className="mt-3 rounded-xl bg-canvas p-3 text-sm text-ink/85">
          <span className="font-semibold">Provider notes: </span>
          {a.provider_instructions}
        </p>
      ) : null}
      {a.cancellation_reason ? <p className="mt-2 text-sm text-muted">Reason: {a.cancellation_reason}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {upcoming && a.modality === "virtual" && a.virtual_visit_url ? (
          <a href={a.virtual_visit_url} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "sm")}>
            Join virtual visit <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">(opens the provider&apos;s video link in a new tab)</span>
          </a>
        ) : null}
        {upcoming && a.modality === "virtual" && !a.virtual_visit_url ? (
          <p className="text-sm text-muted">The provider will share a visit link before your appointment.</p>
        ) : null}
        <form action={startConversationAction}>
          <input type="hidden" name="providerId" value={a.provider_id} />
          {viewer === "provider" ? <input type="hidden" name="patientId" value={a.patient_id} /> : null}
          <button type="submit" className={buttonClasses("secondary", "sm")}>
            <MessageSquare aria-hidden className="size-4" /> Message
          </button>
        </form>
        {upcoming && viewer === "patient" ? (
          <Link href={`/providers/${a.provider_slug}/request?reschedule=${a.id}`} className={buttonClasses("ghost", "sm")}>
            Request new time
          </Link>
        ) : null}
      </div>
      {upcoming ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-red-700 hover:underline">Cancel appointment</summary>
          <ActionForm action={cancelAppointmentAction} className="mt-3 space-y-3">
            <input type="hidden" name="appointmentId" value={a.id} />
            <TextField label="Reason (optional, shared with the other party)" name="reason" maxLength={500} />
            <SubmitButton variant="danger" size="sm" pendingLabel="Cancelling…">Confirm cancellation</SubmitButton>
          </ActionForm>
        </details>
      ) : null}
    </li>
  );
}

export function PatientRequestItem({ r }: { r: RequestRow }) {
  return (
    <li className="rounded-2xl bg-white p-5 ring-1 ring-line/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-ink">{formatDateTime(r.requested_start, r.timezone ?? undefined)}</p>
          <p className="mt-1 text-sm">
            <Link href={`/providers/${r.provider_slug}`} className="font-medium text-brand-700 hover:underline">{r.provider_name}</Link>
            {r.service_name ? ` · ${r.service_name}` : ""} · {r.modality === "virtual" ? "Virtual" : "In person"}
            {r.reschedule_of ? " · Reschedule request" : ""}
          </p>
        </div>
        <Badge tone={statusTone[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
      </div>
      {r.provider_message ? (
        <p className="mt-3 rounded-xl bg-canvas p-3 text-sm"><span className="font-semibold">Provider: </span>{r.provider_message}</p>
      ) : null}
      {r.status === "pending" ? (
        <ActionForm action={withdrawRequestAction} className="mt-3">
          <input type="hidden" name="requestId" value={r.id} />
          <SubmitButton variant="ghost" size="sm" pendingLabel="Withdrawing…">Withdraw request</SubmitButton>
        </ActionForm>
      ) : null}
    </li>
  );
}

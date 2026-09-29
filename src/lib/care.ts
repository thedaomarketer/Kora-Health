import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { asUser } from "@/lib/db";

export interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "cancelled_by_patient" | "cancelled_by_provider" | "rescheduled" | "completed" | "no_show";
  modality: "virtual" | "in_person";
  virtual_visit_url: string | null;
  provider_instructions: string | null;
  cancellation_reason: string | null;
  patient_id: string;
  patient_display_name: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string;
  service_name: string | null;
  location: string | null;
  timezone: string | null;
}

export interface RequestRow {
  id: string;
  requested_start: string;
  requested_end: string;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired";
  modality: "virtual" | "in_person";
  patient_note: string | null;
  provider_message: string | null;
  patient_id: string;
  patient_display_name: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string;
  service_name: string | null;
  reschedule_of: string | null;
  created_at: string;
  timezone: string | null;
}

// RLS limits every query below to rows where the caller is a party.
const APPOINTMENT_SELECT = `
  select a.id, a.starts_at, a.ends_at, a.status, a.modality, a.virtual_visit_url, a.provider_instructions,
         a.cancellation_reason, a.patient_id, a.patient_display_name, a.provider_id,
         concat_ws(' ', p.honorific, p.display_name) as provider_name, p.slug as provider_slug,
         s.name as service_name,
         case when l.id is not null then concat_ws(', ', l.address_line1, l.city, l.region) end as location,
         (select av.timezone from public.availability av where av.provider_id = a.provider_id limit 1) as timezone
    from public.appointments a
    join public.provider_profiles p on p.id = a.provider_id
    left join public.services s on s.id = a.service_id
    left join public.locations l on l.id = a.location_id`;

const REQUEST_SELECT = `
  select r.id, r.requested_start, r.requested_end, r.status, r.modality, r.patient_note, r.provider_message,
         r.patient_id, r.patient_display_name, r.provider_id,
         concat_ws(' ', p.honorific, p.display_name) as provider_name, p.slug as provider_slug,
         s.name as service_name, r.reschedule_of, r.created_at,
         (select av.timezone from public.availability av where av.provider_id = r.provider_id limit 1) as timezone
    from public.appointment_requests r
    join public.provider_profiles p on p.id = r.provider_id
    left join public.services s on s.id = r.service_id`;

export async function listAppointments(user: SessionUser, scope: "upcoming" | "past", limit = 50) {
  return asUser(user, (q) =>
    q<AppointmentRow>(
      scope === "upcoming"
        ? `${APPOINTMENT_SELECT} where a.status = 'confirmed' and a.ends_at >= now() order by a.starts_at asc limit $1`
        : `${APPOINTMENT_SELECT} where not (a.status = 'confirmed' and a.ends_at >= now()) order by a.starts_at desc limit $1`,
      [limit],
    ),
  );
}

export async function listRequests(user: SessionUser, status: "pending" | "recent", limit = 50) {
  return asUser(user, (q) =>
    q<RequestRow>(
      status === "pending"
        ? `${REQUEST_SELECT} where r.status = 'pending' order by r.requested_start asc limit $1`
        : `${REQUEST_SELECT} where r.status <> 'pending' and r.created_at > now() - interval '90 days' order by r.created_at desc limit $1`,
      [limit],
    ),
  );
}

export interface ConversationRow {
  id: string;
  provider_id: string;
  provider_name: string;
  provider_slug: string;
  patient_id: string;
  patient_display_name: string;
  status: "open" | "closed" | "locked";
  last_message_at: string | null;
  last_message: string | null;
  unread: number;
}

export async function listConversations(user: SessionUser) {
  return asUser(user, (q) =>
    q<ConversationRow>(
      `select c.id, c.provider_id, concat_ws(' ', p.honorific, p.display_name) as provider_name, p.slug as provider_slug,
              c.patient_id, c.patient_display_name, c.status, c.last_message_at,
              (select left(m.body, 140) from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1) as last_message,
              (select count(*)::int from public.messages m where m.conversation_id = c.id and m.sender_id <> auth.uid() and m.read_at is null) as unread
         from public.conversations c
         join public.provider_profiles p on p.id = c.provider_id
        order by c.last_message_at desc nulls last, c.created_at desc`,
    ),
  );
}

export interface MessageRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  attachment_id: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
}

export async function getConversation(user: SessionUser, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  return asUser(user, async (q) => {
    const [conversation] = await q<ConversationRow>(
      `select c.id, c.provider_id, concat_ws(' ', p.honorific, p.display_name) as provider_name, p.slug as provider_slug,
              c.patient_id, c.patient_display_name, c.status, c.last_message_at, null as last_message, 0 as unread
         from public.conversations c join public.provider_profiles p on p.id = c.provider_id
        where c.id = $1`,
      [id],
    );
    if (!conversation) return null;
    const messages = await q<MessageRow>(
      `select m.id, m.sender_id, m.body, m.created_at, m.read_at, m.attachment_id,
              ma.file_name as attachment_name, ma.size_bytes as attachment_size
         from public.messages m left join public.message_attachments ma on ma.id = m.attachment_id
        where m.conversation_id = $1 order by m.created_at asc limit 500`,
      [id],
    );
    await q(`select public.mark_conversation_read($1)`, [id]);
    return { conversation, messages };
  });
}

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentRow["status"], string> = {
  confirmed: "Confirmed",
  cancelled_by_patient: "Cancelled by patient",
  cancelled_by_provider: "Cancelled by provider",
  rescheduled: "Rescheduled",
  completed: "Completed",
  no_show: "Missed",
};

export const REQUEST_STATUS_LABEL: Record<RequestRow["status"], string> = {
  pending: "Awaiting provider",
  accepted: "Confirmed",
  declined: "Declined",
  withdrawn: "Withdrawn",
  expired: "Expired",
};

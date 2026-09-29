-- =============================================================================
-- Kora Health — Care coordination: appointment requests, appointments,
-- secure messaging, notifications, reports/moderation.
--
-- All state transitions run through SECURITY DEFINER functions; clients only
-- get SELECT on these tables (plus narrowly-scoped INSERT on messages/reports).
-- =============================================================================

create type public.request_status as enum ('pending', 'accepted', 'declined', 'withdrawn', 'expired');
create type public.appointment_status as enum (
  'confirmed', 'cancelled_by_patient', 'cancelled_by_provider', 'rescheduled', 'completed', 'no_show'
);
create type public.visit_modality as enum ('virtual', 'in_person');

-- ---------------------------------------------------------------------------
-- Notifications (created by triggers/functions only). Bodies never contain
-- message content or health details — only neutral prompts to sign in.
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]+(\.[a-z_]+)*$'),
  title text not null check (char_length(title) <= 160),
  body text check (char_length(body) <= 500),
  link text check (link is null or link ~ '^/[A-Za-z0-9/_\-?=&.]*$'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create or replace function public.notify(
  p_user uuid, p_kind text, p_title text, p_body text, p_link text
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, title, body, link)
  values (p_user, p_kind, p_title, p_body, p_link);
$$;

-- ---------------------------------------------------------------------------
-- Appointment requests & appointments
-- ---------------------------------------------------------------------------
create table public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  modality public.visit_modality not null,
  requested_start timestamptz not null,
  requested_end timestamptz not null,
  patient_note text check (char_length(patient_note) <= 1000),
  patient_display_name text not null default '' check (char_length(patient_display_name) <= 120),
  status public.request_status not null default 'pending',
  provider_message text check (char_length(provider_message) <= 1000),
  responded_at timestamptz,
  reschedule_of uuid,
  created_at timestamptz not null default now(),
  check (requested_end > requested_start)
);
create index appointment_requests_patient_idx on public.appointment_requests (patient_id, created_at desc);
create index appointment_requests_provider_idx on public.appointment_requests (provider_id, status, requested_start);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique references public.appointment_requests (id) on delete set null,
  patient_id uuid not null references public.users (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  modality public.visit_modality not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location_id uuid references public.locations (id) on delete set null,
  virtual_visit_url text check (virtual_visit_url is null or virtual_visit_url ~ '^https://'),
  provider_instructions text check (char_length(provider_instructions) <= 1000),
  patient_display_name text not null default '',
  status public.appointment_status not null default 'confirmed',
  cancellation_reason text check (char_length(cancellation_reason) <= 500),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- A provider cannot hold two confirmed appointments that overlap.
  constraint appointments_no_overlap exclude using gist (
    provider_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'confirmed')
);
create index appointments_patient_idx on public.appointments (patient_id, starts_at);
create index appointments_provider_idx on public.appointments (provider_id, starts_at);

alter table public.appointment_requests
  add constraint appointment_requests_reschedule_fk
  foreign key (reschedule_of) references public.appointments (id) on delete set null;

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- Is [p_start, p_end) inside one of the provider's weekly availability
-- windows (evaluated in the window's own time zone)?
create or replace function public.slot_within_availability(
  p_provider uuid, p_start timestamptz, p_end timestamptz, p_modality public.visit_modality
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.availability a
    where a.provider_id = p_provider
      and (a.modality = 'both' or a.modality::text = p_modality::text)
      and extract(dow from (p_start at time zone a.timezone))::int = a.weekday
      and (p_start at time zone a.timezone)::date = (p_end at time zone a.timezone)::date
      and (p_start at time zone a.timezone)::time >= a.start_time
      and (p_end at time zone a.timezone)::time <= a.end_time
  );
$$;

create or replace function public.create_appointment_request(
  p_provider_id uuid,
  p_service_id uuid,
  p_modality public.visit_modality,
  p_start timestamptz,
  p_note text,
  p_reschedule_of uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient uuid := auth.uid();
  v_duration integer := 30;
  v_end timestamptz;
  v_provider record;
  v_service record;
  v_id uuid;
  v_name text;
  v_provider_user uuid;
begin
  if public.current_app_role() is distinct from 'patient' then
    raise exception 'only patient accounts can request appointments' using errcode = '42501';
  end if;
  if not public.provider_is_public(p_provider_id) then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;

  select * into v_provider from public.provider_profiles where id = p_provider_id;
  v_provider_user := v_provider.user_id;

  if p_reschedule_of is null and not v_provider.accepting_new_patients
     and not exists (select 1 from public.appointments
                     where patient_id = v_patient and provider_id = p_provider_id) then
    raise exception 'this provider is not accepting new patients' using errcode = '22023';
  end if;
  if p_modality = 'virtual' and not v_provider.offers_virtual then
    raise exception 'this provider does not offer virtual appointments' using errcode = '22023';
  end if;
  if p_modality = 'in_person' and not v_provider.offers_in_person then
    raise exception 'this provider does not offer in-person appointments' using errcode = '22023';
  end if;

  if p_service_id is not null then
    select * into v_service from public.services
    where id = p_service_id and provider_id = p_provider_id and is_active;
    if not found then
      raise exception 'service not found' using errcode = 'P0002';
    end if;
    if v_service.modality <> 'both' and v_service.modality::text <> p_modality::text then
      raise exception 'service is not offered for this visit type' using errcode = '22023';
    end if;
    v_duration := v_service.duration_minutes;
  end if;

  if p_start < now() + interval '1 hour' then
    raise exception 'appointments must be requested at least 1 hour in advance' using errcode = '22023';
  end if;
  if p_start > now() + interval '180 days' then
    raise exception 'appointments can be requested up to 180 days ahead' using errcode = '22023';
  end if;
  v_end := p_start + make_interval(mins => v_duration);

  if not public.slot_within_availability(p_provider_id, p_start, v_end, p_modality) then
    raise exception 'requested time is outside the provider''s availability' using errcode = '22023';
  end if;
  if exists (select 1 from public.appointments
             where provider_id = p_provider_id and status = 'confirmed'
               and tstzrange(starts_at, ends_at) && tstzrange(p_start, v_end)) then
    raise exception 'that time is no longer available' using errcode = '22023';
  end if;

  if p_reschedule_of is not null and not exists (
    select 1 from public.appointments
    where id = p_reschedule_of and patient_id = v_patient
      and provider_id = p_provider_id and status = 'confirmed') then
    raise exception 'appointment to reschedule not found' using errcode = 'P0002';
  end if;

  -- Anti-spam limits.
  if (select count(*) from public.appointment_requests
      where patient_id = v_patient and provider_id = p_provider_id and status = 'pending') >= 3 then
    raise exception 'you already have 3 pending requests with this provider' using errcode = '22023';
  end if;
  if (select count(*) from public.appointment_requests
      where patient_id = v_patient and status = 'pending') >= 10 then
    raise exception 'you have too many pending requests' using errcode = '22023';
  end if;

  select coalesce(nullif(display_name, ''), 'Kora member') into v_name from public.users where id = v_patient;

  insert into public.appointment_requests
    (patient_id, provider_id, service_id, modality, requested_start, requested_end,
     patient_note, patient_display_name, reschedule_of)
  values
    (v_patient, p_provider_id, p_service_id, p_modality, p_start, v_end,
     nullif(trim(p_note), ''), v_name, p_reschedule_of)
  returning id into v_id;

  perform public.notify(v_provider_user, 'appointment.request_received',
    case when p_reschedule_of is null then 'New appointment request' else 'Reschedule request' end,
    'A patient has requested an appointment. Sign in to review it.',
    '/provider/appointments');
  perform public.write_audit('appointment.request_created', 'appointment_request', v_id::text, v_patient,
    jsonb_build_object('provider_id', p_provider_id, 'reschedule_of', p_reschedule_of));
  return v_id;
end;
$$;

create or replace function public.respond_to_appointment_request(
  p_request_id uuid,
  p_accept boolean,
  p_message text,
  p_location_id uuid default null,
  p_virtual_visit_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req record;
  v_appt uuid;
begin
  select r.* into v_req
  from public.appointment_requests r
  where r.id = p_request_id and public.owns_provider(r.provider_id)
  for update;

  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'request is no longer pending' using errcode = '22023';
  end if;

  if not p_accept then
    update public.appointment_requests
       set status = 'declined', provider_message = nullif(trim(p_message), ''), responded_at = now()
     where id = p_request_id;
    perform public.notify(v_req.patient_id, 'appointment.request_declined', 'Appointment request update',
      'A provider responded to your appointment request.', '/patient/appointments');
    perform public.write_audit('appointment.request_declined', 'appointment_request', p_request_id::text, v_req.patient_id);
    return null;
  end if;

  if v_req.requested_start < now() then
    update public.appointment_requests set status = 'expired', responded_at = now() where id = p_request_id;
    raise exception 'request time has already passed' using errcode = '22023';
  end if;
  if p_location_id is not null and not exists (
    select 1 from public.locations where id = p_location_id and provider_id = v_req.provider_id) then
    raise exception 'location not found' using errcode = 'P0002';
  end if;
  if p_virtual_visit_url is not null and p_virtual_visit_url !~ '^https://' then
    raise exception 'virtual visit link must use https' using errcode = '22023';
  end if;

  -- Rescheduling: release the original slot first so the new one can be booked.
  if v_req.reschedule_of is not null then
    update public.appointments set status = 'rescheduled'
     where id = v_req.reschedule_of and status = 'confirmed';
  end if;

  insert into public.appointments
    (request_id, patient_id, provider_id, service_id, modality, starts_at, ends_at,
     location_id, virtual_visit_url, provider_instructions, patient_display_name)
  values
    (p_request_id, v_req.patient_id, v_req.provider_id, v_req.service_id, v_req.modality,
     v_req.requested_start, v_req.requested_end, p_location_id, p_virtual_visit_url,
     nullif(trim(p_message), ''), v_req.patient_display_name)
  returning id into v_appt;

  update public.appointment_requests
     set status = 'accepted', provider_message = nullif(trim(p_message), ''), responded_at = now()
   where id = p_request_id;

  perform public.notify(v_req.patient_id, 'appointment.confirmed', 'Appointment confirmed',
    'A provider confirmed your appointment. Sign in to see the details.', '/patient/appointments');
  perform public.write_audit('appointment.confirmed', 'appointment', v_appt::text, v_req.patient_id,
    jsonb_build_object('request_id', p_request_id));
  return v_appt;
exception
  when exclusion_violation then
    raise exception 'this time overlaps another confirmed appointment' using errcode = '22023';
end;
$$;

create or replace function public.withdraw_appointment_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.appointment_requests
     set status = 'withdrawn', responded_at = now()
   where id = p_request_id and patient_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'pending request not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('appointment.request_withdrawn', 'appointment_request', p_request_id::text, auth.uid());
end;
$$;

create or replace function public.cancel_appointment(p_appointment_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt record;
  v_is_patient boolean;
  v_other uuid;
begin
  select a.*, p.user_id as provider_user_id into v_appt
  from public.appointments a
  join public.provider_profiles p on p.id = a.provider_id
  where a.id = p_appointment_id
    and (a.patient_id = auth.uid() or p.user_id = auth.uid())
  for update of a;

  if not found then
    raise exception 'appointment not found' using errcode = 'P0002';
  end if;
  if v_appt.status <> 'confirmed' then
    raise exception 'only confirmed appointments can be cancelled' using errcode = '22023';
  end if;
  if v_appt.ends_at < now() then
    raise exception 'past appointments cannot be cancelled' using errcode = '22023';
  end if;

  v_is_patient := v_appt.patient_id = auth.uid();
  v_other := case when v_is_patient then v_appt.provider_user_id else v_appt.patient_id end;

  update public.appointments
     set status = case when v_is_patient then 'cancelled_by_patient'::public.appointment_status
                       else 'cancelled_by_provider'::public.appointment_status end,
         cancellation_reason = nullif(trim(p_reason), '')
   where id = p_appointment_id;

  perform public.notify(v_other, 'appointment.cancelled', 'Appointment cancelled',
    'An upcoming appointment was cancelled. Sign in for details.',
    case when v_is_patient then '/provider/appointments' else '/patient/appointments' end);
  perform public.write_audit('appointment.cancelled', 'appointment', p_appointment_id::text, v_appt.patient_id,
    jsonb_build_object('by', case when v_is_patient then 'patient' else 'provider' end));
end;
$$;

create or replace function public.provider_update_appointment(
  p_appointment_id uuid,
  p_status public.appointment_status,
  p_virtual_visit_url text,
  p_instructions text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appt record;
begin
  select a.* into v_appt from public.appointments a
  where a.id = p_appointment_id and public.owns_provider(a.provider_id)
  for update;
  if not found then
    raise exception 'appointment not found' using errcode = 'P0002';
  end if;
  if p_status is not null and p_status <> v_appt.status then
    if v_appt.status <> 'confirmed' or p_status not in ('completed', 'no_show') then
      raise exception 'invalid status change' using errcode = '22023';
    end if;
    if v_appt.starts_at > now() then
      raise exception 'appointment has not started yet' using errcode = '22023';
    end if;
  end if;
  if p_virtual_visit_url is not null and p_virtual_visit_url <> '' and p_virtual_visit_url !~ '^https://' then
    raise exception 'virtual visit link must use https' using errcode = '22023';
  end if;

  update public.appointments
     set status = coalesce(p_status, status),
         virtual_visit_url = nullif(trim(coalesce(p_virtual_visit_url, virtual_visit_url, '')), ''),
         provider_instructions = coalesce(nullif(trim(p_instructions), ''), provider_instructions)
   where id = p_appointment_id;
  perform public.write_audit('appointment.updated', 'appointment', p_appointment_id::text, v_appt.patient_id,
    jsonb_build_object('status', coalesce(p_status, v_appt.status)));
end;
$$;

-- Called by the scheduled job (service role) to create in-app reminders for
-- confirmed appointments starting within the next 24 hours.
create or replace function public.generate_appointment_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select a.id, a.patient_id, p.user_id as provider_user_id
    from public.appointments a
    join public.provider_profiles p on p.id = a.provider_id
    where a.status = 'confirmed'
      and a.reminder_sent_at is null
      and a.starts_at between now() and now() + interval '24 hours'
    for update of a skip locked
  loop
    perform public.notify(r.patient_id, 'appointment.reminder', 'Upcoming appointment',
      'You have an appointment within the next 24 hours.', '/patient/appointments');
    perform public.notify(r.provider_user_id, 'appointment.reminder', 'Upcoming appointment',
      'You have an appointment within the next 24 hours.', '/provider/appointments');
    update public.appointments set reminder_sent_at = now() where id = r.id;
    v_count := v_count + 1;
  end loop;

  update public.appointment_requests
     set status = 'expired', responded_at = now()
   where status = 'pending' and requested_start < now();
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  patient_display_name text not null default '',
  status text not null default 'open' check (status in ('open', 'closed', 'locked')),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  unique (patient_id, provider_id)
);
create index conversations_provider_idx on public.conversations (provider_id, last_message_at desc);
create index conversations_patient_idx on public.conversations (patient_id, last_message_at desc);

create table public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  uploaded_by uuid not null references public.users (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) <= 300),
  file_name text not null check (char_length(file_name) between 1 and 200),
  mime_type text not null check (mime_type in ('application/pdf', 'image/png', 'image/jpeg')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  attachment_id uuid references public.message_attachments (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

create or replace function public.is_conversation_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    left join public.provider_profiles p on p.id = c.provider_id
    where c.id = p_conversation
      and (c.patient_id = auth.uid() or p.user_id = auth.uid())
  );
$$;

-- Patients can open a thread with a provider they have an appointment
-- request or appointment with; providers can open one with such a patient.
create or replace function public.start_conversation(p_provider_id uuid, p_patient_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient uuid;
  v_id uuid;
  v_name text;
begin
  if public.current_app_role() = 'patient' then
    v_patient := auth.uid();
  elsif public.current_app_role() = 'provider' and public.owns_provider(p_provider_id) then
    v_patient := p_patient_id;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if v_patient is null or not exists (
    select 1 from public.appointment_requests where patient_id = v_patient and provider_id = p_provider_id
    union all
    select 1 from public.appointments where patient_id = v_patient and provider_id = p_provider_id) then
    raise exception 'messaging opens after an appointment request' using errcode = '42501';
  end if;

  select id into v_id from public.conversations where patient_id = v_patient and provider_id = p_provider_id;
  if v_id is null then
    select coalesce(nullif(display_name, ''), 'Kora member') into v_name from public.users where id = v_patient;
    insert into public.conversations (patient_id, provider_id, patient_display_name)
    values (v_patient, p_provider_id, v_name)
    returning id into v_id;
    perform public.write_audit('message.conversation_started', 'conversation', v_id::text, v_patient);
  end if;
  return v_id;
end;
$$;

create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv record;
  v_recipient uuid;
  v_link text;
begin
  select c.*, p.user_id as provider_user_id into v_conv
  from public.conversations c join public.provider_profiles p on p.id = c.provider_id
  where c.id = new.conversation_id;

  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;

  if new.sender_id = v_conv.patient_id then
    v_recipient := v_conv.provider_user_id;
    v_link := '/provider/messages/' || new.conversation_id;
  else
    v_recipient := v_conv.patient_id;
    v_link := '/patient/messages/' || new.conversation_id;
  end if;

  -- One unread notification per conversation at a time.
  if not exists (select 1 from public.notifications
                 where user_id = v_recipient and link = v_link and read_at is null) then
    perform public.notify(v_recipient, 'message.received', 'New message',
      'You have a new secure message. Sign in to read it.', v_link);
  end if;
  return new;
end;
$$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_participant(p_conversation) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  update public.messages set read_at = now()
   where conversation_id = p_conversation and sender_id <> auth.uid() and read_at is null;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null and link like '%/messages/' || p_conversation::text;
end;
$$;

create or replace function public.close_conversation(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_conversation_participant(p_conversation) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  update public.conversations set status = 'closed' where id = p_conversation and status = 'open';
  perform public.write_audit('message.conversation_closed', 'conversation', p_conversation::text, auth.uid());
end;
$$;

-- ---------------------------------------------------------------------------
-- Reports (abuse / safety / profile accuracy)
-- ---------------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users (id) on delete set null,
  target_type text not null check (target_type in ('provider_profile', 'message', 'conversation', 'user')),
  target_id uuid not null,
  reason text not null check (reason in (
    'inaccurate_information', 'impersonation', 'harassment', 'spam', 'inappropriate_content',
    'safety_concern', 'privacy_concern', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  resolved_by uuid references public.users (id) on delete set null,
  resolution_note text check (char_length(resolution_note) <= 1000),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index reports_status_idx on public.reports (status, created_at desc);

create or replace function public.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Message/conversation reports require the reporter to be a participant.
  if new.target_type = 'message' and not exists (
    select 1 from public.messages m where m.id = new.target_id
      and public.is_conversation_participant(m.conversation_id)) then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  if new.target_type = 'conversation' and not public.is_conversation_participant(new.target_id) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  if (select count(*) from public.reports
      where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'report limit reached, try again later' using errcode = '22023';
  end if;
  new.status := 'open';
  new.resolved_by := null;
  new.resolution_note := null;
  new.resolved_at := null;
  return new;
end;
$$;
create trigger reports_before_insert before insert on public.reports
  for each row execute function public.reports_before_insert();

create or replace function public.resolve_report(p_report_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role('moderator') then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  if p_status not in ('reviewing', 'actioned', 'dismissed') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  update public.reports
     set status = p_status, resolution_note = nullif(trim(p_note), ''),
         resolved_by = auth.uid(),
         resolved_at = case when p_status in ('actioned', 'dismissed') then now() else null end
   where id = p_report_id;
  if not found then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('admin.report_' || p_status, 'report', p_report_id::text, null);
end;
$$;

-- Moderators may read a reported message (and only that message) for review.
create or replace function public.admin_get_reported_message(p_report_id uuid)
returns table (message_id uuid, conversation_id uuid, sender_id uuid, body text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
begin
  if not public.has_admin_role('moderator') then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  select target_id into v_target from public.reports where id = p_report_id and target_type = 'message';
  if v_target is null then
    raise exception 'report not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('admin.reported_message_viewed', 'report', p_report_id::text, null);
  return query select m.id, m.conversation_id, m.sender_id, m.body, m.created_at
               from public.messages m where m.id = v_target;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS & privileges
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.appointment_requests enable row level security;
alter table public.appointments enable row level security;
alter table public.conversations enable row level security;
alter table public.message_attachments enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

revoke all on public.notifications, public.appointment_requests, public.appointments,
  public.conversations, public.message_attachments, public.messages, public.reports
  from anon, authenticated;

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
create policy notifications_owner_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_owner_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_owner_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

grant select on public.appointment_requests, public.appointments to authenticated;
create policy appointment_requests_parties on public.appointment_requests for select to authenticated
  using (patient_id = auth.uid() or public.owns_provider(provider_id));
create policy appointments_parties on public.appointments for select to authenticated
  using (patient_id = auth.uid() or public.owns_provider(provider_id));

grant select on public.conversations, public.messages, public.message_attachments to authenticated;
grant insert (conversation_id, body, attachment_id) on public.messages to authenticated;
grant insert (conversation_id, storage_path, file_name, mime_type, size_bytes) on public.message_attachments to authenticated;

create policy conversations_parties on public.conversations for select to authenticated
  using (patient_id = auth.uid() or public.owns_provider(provider_id));
create policy messages_parties_read on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy messages_parties_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_active_user()
    and public.is_conversation_participant(conversation_id)
    and exists (select 1 from public.conversations c where c.id = conversation_id and c.status = 'open')
    and (attachment_id is null or exists (
      select 1 from public.message_attachments ma
      where ma.id = attachment_id and ma.conversation_id = messages.conversation_id
        and ma.uploaded_by = auth.uid()))
  );
alter table public.messages alter column sender_id set default auth.uid();

create policy message_attachments_parties_read on public.message_attachments for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy message_attachments_insert on public.message_attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_conversation_participant(conversation_id)
              and storage_path like conversation_id::text || '/%');
alter table public.message_attachments alter column uploaded_by set default auth.uid();

grant select on public.reports to authenticated;
grant insert (target_type, target_id, reason, details) on public.reports to authenticated;
alter table public.reports alter column reporter_id set default auth.uid();
create policy reports_insert_own on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());
create policy reports_read on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.has_admin_role('moderator'));

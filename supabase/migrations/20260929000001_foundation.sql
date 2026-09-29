-- =============================================================================
-- Kora Health — Foundation
-- Users, roles, administrators, audit logging, rate limiting, consents.
--
-- Conventions (see CLAUDE.md → Database):
--   * RLS is enabled on every table. Privileges are revoked from anon and
--     authenticated and re-granted explicitly (least privilege, column-level
--     where users may edit only some columns).
--   * State transitions that need cross-row checks run through
--     SECURITY DEFINER functions with `set search_path = ''`.
--   * Every sensitive action writes to public.audit_logs.
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('patient', 'provider');
create type public.admin_role as enum ('moderator', 'verifier', 'superadmin');
create type public.account_status as enum ('active', 'suspended');

-- ---------------------------------------------------------------------------
-- Generic helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- users: one row per auth.users row. Role is chosen at sign-up and can never
-- be changed by the user. Admin privileges live in public.administrators.
-- ---------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null,
  email text not null,
  display_name text not null default '' check (char_length(display_name) <= 120),
  status public.account_status not null default 'active',
  status_reason text check (char_length(status_reason) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- administrators: admin privileges are granted only by a superadmin (or by an
-- operator with database access for the first superadmin — see CLAUDE.md).
-- ---------------------------------------------------------------------------
create table public.administrators (
  user_id uuid primary key references public.users (id) on delete cascade,
  admin_role public.admin_role not null,
  granted_by uuid references public.users (id) on delete set null,
  granted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Authorization helpers (SECURITY DEFINER so policies can call them without
-- recursive RLS evaluation). All are STABLE and read-only.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.administrators a
    join public.users u on u.id = a.user_id
    where a.user_id = auth.uid() and u.status = 'active'
  );
$$;

create or replace function public.has_admin_role(required public.admin_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.administrators a
    join public.users u on u.id = a.user_id
    where a.user_id = auth.uid()
      and u.status = 'active'
      and (a.admin_role = required or a.admin_role = 'superadmin')
  );
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = auth.uid() and status = 'active';
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users where id = auth.uid() and status = 'active');
$$;

-- ---------------------------------------------------------------------------
-- audit_logs: append-only. No foreign keys so records survive account
-- deletion (they hold pseudonymous ids only). Updates/deletes are blocked
-- except for an explicit retention job.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  subject_user_id uuid,
  action text not null check (action ~ '^[a-z_]+(\.[a-z_]+)+$'),
  target_type text check (char_length(target_type) <= 60),
  target_id text check (char_length(target_id) <= 120),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_subject_idx on public.audit_logs (subject_user_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('kora.audit_retention', true), '') <> 'on' then
    raise exception 'audit_logs are append-only' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- Internal writer used by other SECURITY DEFINER functions and triggers.
create or replace function public.write_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_subject uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, subject_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), p_subject, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
$$;

-- Application-facing writer: callers can only record events about
-- themselves and cannot write admin.* or system.* events.
create or replace function public.record_audit_event(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_action like 'admin.%' or p_action like 'system.%' then
    raise exception 'reserved audit namespace' using errcode = '42501';
  end if;
  perform public.write_audit(p_action, p_target_type, p_target_id, auth.uid(), p_metadata);
end;
$$;

-- ---------------------------------------------------------------------------
-- Rate limiting (fixed window, per authenticated user). The key is always
-- bound to auth.uid() so users cannot exhaust each other's budgets.
-- ---------------------------------------------------------------------------
create table public.rate_limits (
  bucket text not null,
  subject text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, subject, window_start)
);

create or replace function public.check_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject text := auth.uid()::text;
  v_window timestamptz;
  v_hits integer;
begin
  if v_subject is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit parameters';
  end if;
  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits as r (bucket, subject, window_start, hits)
  values (p_bucket, v_subject, v_window, 1)
  on conflict (bucket, subject, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;

  -- Opportunistic cleanup of stale windows for this subject.
  delete from public.rate_limits
  where subject = v_subject and window_start < now() - interval '2 days';

  return v_hits <= p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- consents: append-only ledger. Current state = most recent row per type.
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  consent_type text not null check (consent_type in (
    'terms_of_service',
    'privacy_policy',
    'ai_assistant',
    'health_data_storage',
    'matching_personalization',
    'product_updates'
  )),
  version text not null check (char_length(version) between 1 and 20),
  granted boolean not null,
  created_at timestamptz not null default now()
);

create index consents_user_type_idx on public.consents (user_id, consent_type, created_at desc);

create view public.current_consents
with (security_invoker = true)
as
select distinct on (user_id, consent_type)
  user_id, consent_type, version, granted, created_at
from public.consents
order by user_id, consent_type, created_at desc;

create or replace function public.has_consent(p_user uuid, p_type text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select granted from public.consents
    where user_id = p_user and consent_type = p_type
    order by created_at desc
    limit 1
  ), false);
$$;

create or replace function public.consents_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit(
    case when new.granted then 'consent.granted' else 'consent.revoked' end,
    'consent', new.consent_type, new.user_id,
    jsonb_build_object('version', new.version)
  );
  return new;
end;
$$;

create trigger consents_after_insert after insert on public.consents
  for each row execute function public.consents_audit();

-- ---------------------------------------------------------------------------
-- New auth user → public.users. Role comes from sign-up metadata and is
-- restricted to patient/provider; admin can never be self-assigned.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_name text;
begin
  v_role := case coalesce(new.raw_user_meta_data ->> 'role', 'patient')
              when 'provider' then 'provider'::public.app_role
              else 'patient'::public.app_role
            end;
  v_name := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), ''), 120);

  insert into public.users (id, role, email, display_name)
  values (new.id, v_role, coalesce(new.email, ''), v_name);

  perform public.write_audit('account.created', 'user', new.id::text, new.id,
    jsonb_build_object('role', v_role));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep email in sync when it changes in auth.
create or replace function public.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.users set email = coalesce(new.email, '') where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_auth_user_email_change();

-- ---------------------------------------------------------------------------
-- RLS & privileges
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.administrators enable row level security;
alter table public.audit_logs enable row level security;
alter table public.rate_limits enable row level security;
alter table public.consents enable row level security;

revoke all on public.users, public.administrators, public.audit_logs,
  public.rate_limits, public.consents, public.current_consents from anon, authenticated;

-- users
grant select on public.users to authenticated;
grant update (display_name) on public.users to authenticated;

create policy users_select_self_or_admin on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid() and status = 'active')
  with check (id = auth.uid());

-- administrators: visible to admins only; writes via functions.
grant select on public.administrators to authenticated;
create policy administrators_select_admin on public.administrators
  for select to authenticated
  using (public.is_admin() or user_id = auth.uid());

-- audit_logs: admins see all; users see events about themselves.
grant select on public.audit_logs to authenticated;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_admin() or subject_user_id = auth.uid());

-- rate_limits: no direct access.

-- consents: users read and append their own.
grant select, insert on public.consents to authenticated;
grant select on public.current_consents to authenticated;
create policy consents_select_own on public.consents
  for select to authenticated
  using (user_id = auth.uid());
create policy consents_insert_own on public.consents
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

-- Function execution: revoke from public, grant explicitly.
revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_admin_role(public.admin_role) to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.record_audit_event(text, text, text, jsonb) to authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to authenticated;
grant execute on function public.has_consent(uuid, text) to authenticated;
revoke execute on function public.write_audit(text, text, text, uuid, jsonb) from authenticated;

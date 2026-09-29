-- =============================================================================
-- Kora Health — Billing (Stripe-backed, server-side only) and admin functions.
-- =============================================================================

create table public.subscription_plans (
  id text primary key check (id ~ '^[a-z0-9_-]+$'),
  name text not null,
  audience text not null check (audience in ('provider', 'clinic', 'enterprise')),
  description text not null default '',
  price_cents integer check (price_cents >= 0),
  currency text not null default 'cad' check (currency ~ '^[a-z]{3}$'),
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  stripe_price_id text,
  features jsonb not null default '[]'::jsonb,
  -- Plans are hidden until the business sets real pricing and activates them.
  is_active boolean not null default false,
  sort_order smallint not null default 100
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  plan_id text not null references public.subscription_plans (id),
  status text not null check (status in (
    'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (user_id is not null or organization_id is not null)
);
create index subscriptions_user_idx on public.subscriptions (user_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  amount_cents integer not null check (amount_cents >= 0),
  currency text not null check (currency ~ '^[a-z]{3}$'),
  status text not null check (status in ('succeeded', 'failed', 'refunded', 'pending')),
  stripe_invoice_id text unique,
  created_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);

-- Stripe webhook idempotency.
create table public.stripe_events (
  id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_events enable row level security;

revoke all on public.subscription_plans, public.subscriptions, public.payments, public.stripe_events
  from anon, authenticated;

grant select on public.subscription_plans to anon, authenticated;
create policy subscription_plans_read on public.subscription_plans for select to anon, authenticated
  using (is_active);

grant select on public.subscriptions, public.payments to authenticated;
create policy subscriptions_owner on public.subscriptions for select to authenticated
  using (user_id = auth.uid() or public.is_org_admin(organization_id) or public.has_admin_role('superadmin'));
create policy payments_owner on public.payments for select to authenticated
  using (user_id = auth.uid() or public.has_admin_role('superadmin'));

-- ---------------------------------------------------------------------------
-- Admin functions. Every one checks role and writes an audit entry.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_status(p_user uuid, p_status public.account_status, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role('moderator') then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'admins cannot change their own status' using errcode = '42501';
  end if;
  if exists (select 1 from public.administrators where user_id = p_user)
     and not public.has_admin_role('superadmin') then
    raise exception 'superadmin required to change another admin' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  update public.users set status = p_status, status_reason = trim(p_reason) where id = p_user;
  if not found then
    raise exception 'user not found' using errcode = 'P0002';
  end if;
  if p_status = 'suspended' then
    update public.provider_profiles set is_published = false where user_id = p_user;
  end if;
  perform public.write_audit('admin.user_status_changed', 'user', p_user::text, p_user,
    jsonb_build_object('status', p_status, 'reason', trim(p_reason)));
end;
$$;

create or replace function public.admin_suspend_provider(p_provider uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.has_admin_role('verifier') then
    raise exception 'verifier role required' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
  update public.provider_profiles
     set verification_status = 'suspended', verified_at = null, is_published = false
   where id = p_provider
  returning user_id into v_user;
  if v_user is null then
    raise exception 'provider not found' using errcode = 'P0002';
  end if;
  perform public.notify(v_user, 'verification.suspended', 'Profile suspended',
    'Your Kora profile has been suspended. Sign in for details.', '/provider/verification');
  perform public.write_audit('admin.provider_suspended', 'provider_profile', p_provider::text, v_user,
    jsonb_build_object('reason', trim(p_reason)));
end;
$$;

create or replace function public.admin_grant_role(p_user uuid, p_role public.admin_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role('superadmin') then
    raise exception 'superadmin role required' using errcode = '42501';
  end if;
  insert into public.administrators (user_id, admin_role, granted_by)
  values (p_user, p_role, auth.uid())
  on conflict (user_id) do update set admin_role = excluded.admin_role, granted_by = excluded.granted_by, granted_at = now();
  perform public.write_audit('admin.role_granted', 'user', p_user::text, p_user, jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.admin_revoke_role(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role('superadmin') then
    raise exception 'superadmin role required' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'superadmins cannot revoke their own role' using errcode = '42501';
  end if;
  delete from public.administrators where user_id = p_user;
  perform public.write_audit('admin.role_revoked', 'user', p_user::text, p_user);
end;
$$;

-- Aggregate platform metrics — counts only, no personal data.
create or replace function public.admin_platform_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'patients', (select count(*) from public.users where role = 'patient'),
    'providers', (select count(*) from public.users where role = 'provider'),
    'suspended_users', (select count(*) from public.users where status = 'suspended'),
    'published_providers', (select count(*) from public.provider_profiles where is_published and not is_demo),
    'verified_providers', (select count(*) from public.provider_profiles where verification_status = 'verified' and not is_demo),
    'pending_verifications', (select count(*) from public.provider_verifications where status = 'submitted'),
    'open_reports', (select count(*) from public.reports where status in ('open', 'reviewing')),
    'appointment_requests_7d', (select count(*) from public.appointment_requests where created_at > now() - interval '7 days'),
    'appointments_confirmed_7d', (select count(*) from public.appointments where created_at > now() - interval '7 days'),
    'messages_7d', (select count(*) from public.messages where created_at > now() - interval '7 days'),
    'ai_messages_7d', (select count(*) from public.ai_messages where created_at > now() - interval '7 days'),
    'active_integrations', (select count(*) from public.integration_connections where status = 'active')
  );
end;
$$;

-- Provider-facing analytics — counts for the caller's own profile only.
create or replace function public.provider_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_provider uuid := public.current_provider_id();
begin
  if v_provider is null then
    raise exception 'provider profile required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pending_requests', (select count(*) from public.appointment_requests where provider_id = v_provider and status = 'pending'),
    'upcoming_appointments', (select count(*) from public.appointments where provider_id = v_provider and status = 'confirmed' and starts_at > now()),
    'completed_appointments_30d', (select count(*) from public.appointments where provider_id = v_provider and status = 'completed' and starts_at > now() - interval '30 days'),
    'requests_30d', (select count(*) from public.appointment_requests where provider_id = v_provider and created_at > now() - interval '30 days'),
    'saved_by_patients', (select count(*) from public.saved_providers where provider_id = v_provider),
    'patients', (select count(distinct patient_id) from public.appointments where provider_id = v_provider),
    'unread_messages', (select count(*) from public.messages m join public.conversations c on c.id = m.conversation_id
                        where c.provider_id = v_provider and m.sender_id <> auth.uid() and m.read_at is null)
  );
end;
$$;

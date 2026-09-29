-- =============================================================================
-- Kora Health — Directory: professions, specialties, organizations, clinics,
-- provider profiles (public) and credentials/verification (private),
-- services, locations, availability, patient profiles (private).
-- =============================================================================

create type public.verification_status as enum (
  'unverified',  -- nothing submitted
  'pending',     -- submitted, awaiting Kora review
  'verified',    -- Kora staff completed the verification checklist
  'rejected',
  'suspended'
);
create type public.care_modality as enum ('virtual', 'in_person', 'both');

-- ---------------------------------------------------------------------------
-- Reference data
-- ---------------------------------------------------------------------------
create table public.professions (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  sort_order smallint not null default 100
);

create table public.specialties (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null default '',
  sort_order smallint not null default 100
);

-- ---------------------------------------------------------------------------
-- Organizations & clinics
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  org_type text not null default 'practice'
    check (org_type in ('practice', 'clinic_group', 'hospital', 'community_organization', 'other')),
  website text check (website is null or website ~ '^https://'),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  phone text check (char_length(phone) <= 40),
  website text check (website is null or website ~ '^https://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Provider profiles — PUBLIC information only.
-- verification_status / verified_at / is_demo are never user-writable.
-- ---------------------------------------------------------------------------
create table public.provider_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  display_name text not null check (char_length(display_name) between 2 and 120),
  honorific text check (char_length(honorific) <= 20),
  post_nominals text check (char_length(post_nominals) <= 60),
  pronouns text check (char_length(pronouns) <= 40),
  profession_id smallint references public.professions (id),
  headline text check (char_length(headline) <= 160),
  bio text check (char_length(bio) <= 3000),
  languages text[] not null default array['en']
    check (cardinality(languages) between 1 and 20),
  offers_virtual boolean not null default false,
  offers_in_person boolean not null default true,
  accepting_new_patients boolean not null default true,
  payment_options text[] not null default '{}'
    check (payment_options <@ array['public_insurance', 'private_insurance', 'self_pay', 'sliding_scale', 'employer_benefits']),
  insurance_notes text check (char_length(insurance_notes) <= 500),
  clinic_id uuid references public.clinics (id) on delete set null,
  verification_status public.verification_status not null default 'unverified',
  verified_at timestamptz,
  is_published boolean not null default false,
  is_demo boolean not null default false,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_profiles_public_idx on public.provider_profiles (is_published, verification_status);
create index provider_profiles_languages_idx on public.provider_profiles using gin (languages);

create table public.provider_specialties (
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  specialty_id smallint not null references public.specialties (id) on delete cascade,
  is_primary boolean not null default false,
  primary key (provider_id, specialty_id)
);
create index provider_specialties_specialty_idx on public.provider_specialties (specialty_id);

-- Whether a provider profile is publicly discoverable. Rejected, suspended
-- and never-submitted profiles are hidden; pending ones are shown with an
-- explicit "Verification pending" label.
create or replace function public.provider_is_public(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles p
    join public.users u on u.id = p.user_id
    where p.id = p_provider_id
      and p.is_published
      and p.verification_status in ('pending', 'verified')
      and u.status = 'active'
  );
$$;

create or replace function public.owns_provider(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.provider_profiles
    where id = p_provider_id and user_id = auth.uid()
  );
$$;

create or replace function public.current_provider_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.provider_profiles where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Credentials — PRIVATE (owner + admins only).
-- Any change to credentials after verification resets status to pending.
-- ---------------------------------------------------------------------------
create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  credential_type text not null check (credential_type in ('license', 'registration', 'certification', 'degree')),
  issuing_body text not null check (char_length(issuing_body) between 2 and 200),
  jurisdiction text not null check (char_length(jurisdiction) between 2 and 120),
  credential_number text check (char_length(credential_number) <= 80),
  expires_on date,
  document_path text check (char_length(document_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index provider_credentials_provider_idx on public.provider_credentials (provider_id);

create table public.provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected', 'more_info_requested', 'withdrawn')),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.users (id) on delete set null,
  reviewed_at timestamptz,
  decision_reason text check (char_length(decision_reason) <= 1000),
  checks jsonb not null default '{}'::jsonb
);
create index provider_verifications_provider_idx on public.provider_verifications (provider_id, submitted_at desc);
create unique index provider_verifications_one_open_idx
  on public.provider_verifications (provider_id) where status = 'submitted';

create or replace function public.provider_credentials_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid := coalesce(new.provider_id, old.provider_id);
begin
  update public.provider_profiles
     set verification_status = 'pending', verified_at = null
   where id = v_provider and verification_status = 'verified';
  if found then
    insert into public.provider_verifications (provider_id, status, checks)
    values (v_provider, 'submitted', jsonb_build_object('reason', 'credentials_changed'))
    on conflict do nothing;
    perform public.write_audit('provider.verification_reset', 'provider_profile', v_provider::text,
      auth.uid(), jsonb_build_object('reason', 'credentials_changed'));
  end if;
  return coalesce(new, old);
end;
$$;

create trigger provider_credentials_after_change
  after insert or update or delete on public.provider_credentials
  for each row execute function public.provider_credentials_changed();

-- ---------------------------------------------------------------------------
-- Services, locations, availability
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  description text check (char_length(description) <= 1000),
  modality public.care_modality not null default 'both',
  duration_minutes smallint not null default 30 check (duration_minutes between 10 and 240),
  fee_note text check (char_length(fee_note) <= 200),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_provider_idx on public.services (provider_id);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.provider_profiles (id) on delete cascade,
  clinic_id uuid references public.clinics (id) on delete cascade,
  label text check (char_length(label) <= 120),
  address_line1 text check (char_length(address_line1) <= 200),
  address_line2 text check (char_length(address_line2) <= 200),
  city text not null check (char_length(city) between 1 and 120),
  region text check (char_length(region) <= 120),
  country text not null check (country ~ '^[A-Z]{2}$'),
  postal_code text check (char_length(postal_code) <= 20),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (provider_id is not null or clinic_id is not null)
);
create index locations_provider_idx on public.locations (provider_id);
create index locations_city_idx on public.locations (lower(city), country);

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Toronto' check (char_length(timezone) <= 64),
  modality public.care_modality not null default 'both',
  location_id uuid references public.locations (id) on delete set null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index availability_provider_idx on public.availability (provider_id, weekday);

-- Reject unknown IANA time zones.
create or replace function public.availability_validate_tz()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'unknown time zone %', new.timezone using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger availability_validate_tz before insert or update on public.availability
  for each row execute function public.availability_validate_tz();

-- ---------------------------------------------------------------------------
-- Patient profiles — PRIVATE (owner only; not even admins by default).
-- Providers see only a minimal display name snapshot on requests/threads.
-- ---------------------------------------------------------------------------
create table public.patient_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  pronouns text check (char_length(pronouns) <= 40),
  city text check (char_length(city) <= 120),
  region text check (char_length(region) <= 120),
  country text check (country is null or country ~ '^[A-Z]{2}$'),
  preferred_languages text[] not null default array['en'] check (cardinality(preferred_languages) <= 20),
  care_modality_preference public.care_modality not null default 'both',
  payment_preferences text[] not null default '{}'
    check (payment_preferences <@ array['public_insurance', 'private_insurance', 'self_pay', 'sliding_scale', 'employer_benefits']),
  insurance_note text check (char_length(insurance_note) <= 300),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_specialty_interests (
  patient_id uuid not null references public.patient_profiles (user_id) on delete cascade,
  specialty_id smallint not null references public.specialties (id) on delete cascade,
  primary key (patient_id, specialty_id)
);

create table public.saved_providers (
  patient_id uuid not null references public.users (id) on delete cascade,
  provider_id uuid not null references public.provider_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (patient_id, provider_id)
);

-- Create a patient profile row automatically for patient accounts.
create or replace function public.handle_new_patient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role = 'patient' then
    insert into public.patient_profiles (user_id) values (new.id) on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger users_after_insert_patient after insert on public.users
  for each row execute function public.handle_new_patient();

-- ---------------------------------------------------------------------------
-- Provider workflow functions
-- ---------------------------------------------------------------------------

-- Create the caller's provider profile (provider accounts only, once).
create or replace function public.create_provider_profile(
  p_display_name text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if public.current_app_role() is distinct from 'provider' then
    raise exception 'only provider accounts can create a provider profile' using errcode = '42501';
  end if;
  insert into public.provider_profiles (user_id, display_name, slug)
  values (auth.uid(), trim(p_display_name), lower(p_slug))
  returning id into v_id;
  perform public.write_audit('provider.profile_created', 'provider_profile', v_id::text, auth.uid());
  return v_id;
end;
$$;

-- Publishing requires completed onboarding. Publishing never implies
-- verification; the public badge always reflects verification_status.
create or replace function public.provider_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_published and not old.is_published then
    if new.onboarding_completed_at is null then
      raise exception 'complete onboarding before publishing your profile' using errcode = '22023';
    end if;
    if new.profession_id is null then
      raise exception 'add your profession before publishing' using errcode = '22023';
    end if;
    if not exists (select 1 from public.provider_specialties where provider_id = new.id) then
      raise exception 'add at least one specialty before publishing' using errcode = '22023';
    end if;
    if not new.offers_virtual and not exists (select 1 from public.locations where provider_id = new.id) then
      raise exception 'add a practice location or offer virtual care before publishing' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger provider_profiles_guard before update on public.provider_profiles
  for each row execute function public.provider_profiles_guard();

-- Submit profile for verification. Requires at least one license or
-- registration credential on file.
create or replace function public.submit_provider_verification()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid := public.current_provider_id();
  v_id uuid;
  v_status public.verification_status;
begin
  if v_provider is null then
    raise exception 'provider profile required' using errcode = '42501';
  end if;
  select verification_status into v_status from public.provider_profiles where id = v_provider;
  if v_status in ('verified', 'suspended') then
    raise exception 'profile cannot be submitted in status %', v_status using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.provider_credentials
    where provider_id = v_provider and credential_type in ('license', 'registration')
  ) then
    raise exception 'add at least one license or registration before submitting' using errcode = '22023';
  end if;

  select id into v_id from public.provider_verifications
  where provider_id = v_provider and status = 'submitted';
  if v_id is null then
    insert into public.provider_verifications (provider_id) values (v_provider) returning id into v_id;
  end if;

  update public.provider_profiles set verification_status = 'pending' where id = v_provider;
  perform public.write_audit('provider.verification_submitted', 'provider_verification', v_id::text, auth.uid());
  return v_id;
end;
$$;

-- Admin review. Approval requires every checklist item to be confirmed.
create or replace function public.review_provider_verification(
  p_verification_id uuid,
  p_decision text,
  p_reason text,
  p_checks jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_provider uuid;
  v_provider_user uuid;
  v_required text[] := array['license_found_in_public_register', 'name_matches', 'license_active', 'jurisdiction_matches'];
  v_item text;
begin
  if not public.has_admin_role('verifier') then
    raise exception 'verifier role required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected', 'more_info_requested') then
    raise exception 'invalid decision' using errcode = '22023';
  end if;

  select v.provider_id, p.user_id into v_provider, v_provider_user
  from public.provider_verifications v
  join public.provider_profiles p on p.id = v.provider_id
  where v.id = p_verification_id and v.status = 'submitted'
  for update of v;

  if v_provider is null then
    raise exception 'verification not found or already reviewed' using errcode = 'P0002';
  end if;
  if v_provider_user = auth.uid() then
    raise exception 'reviewers cannot review their own profile' using errcode = '42501';
  end if;

  if p_decision = 'approved' then
    foreach v_item in array v_required loop
      if coalesce((p_checks ->> v_item)::boolean, false) is not true then
        raise exception 'verification checklist incomplete: %', v_item using errcode = '22023';
      end if;
    end loop;
  elsif coalesce(trim(p_reason), '') = '' then
    raise exception 'a reason is required when not approving' using errcode = '22023';
  end if;

  update public.provider_verifications
     set status = p_decision,
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         decision_reason = nullif(trim(p_reason), ''),
         checks = coalesce(p_checks, '{}'::jsonb)
   where id = p_verification_id;

  update public.provider_profiles
     set verification_status = case p_decision
           when 'approved' then 'verified'::public.verification_status
           when 'rejected' then 'rejected'::public.verification_status
           else 'unverified'::public.verification_status end,
         verified_at = case when p_decision = 'approved' then now() else null end
   where id = v_provider;

  perform public.notify(v_provider_user, 'verification.decision', 'Verification update',
    'Kora has reviewed your credentials. Sign in to see the result.', '/provider/verification');
  perform public.write_audit('admin.verification_' || p_decision, 'provider_verification',
    p_verification_id::text, v_provider_user,
    jsonb_build_object('provider_id', v_provider, 'checks', p_checks));
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS & privileges
-- ---------------------------------------------------------------------------
alter table public.professions enable row level security;
alter table public.specialties enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.clinics enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_specialties enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.provider_verifications enable row level security;
alter table public.services enable row level security;
alter table public.locations enable row level security;
alter table public.availability enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.patient_specialty_interests enable row level security;
alter table public.saved_providers enable row level security;

revoke all on public.professions, public.specialties, public.organizations,
  public.organization_members, public.clinics, public.provider_profiles,
  public.provider_specialties, public.provider_credentials, public.provider_verifications,
  public.services, public.locations, public.availability, public.patient_profiles,
  public.patient_specialty_interests, public.saved_providers
  from anon, authenticated;

-- Reference data: public read.
grant select on public.professions, public.specialties to anon, authenticated;
create policy professions_read on public.professions for select to anon, authenticated using (true);
create policy specialties_read on public.specialties for select to anon, authenticated using (true);

-- Organization membership helpers (SECURITY DEFINER avoids recursive RLS).
create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organization_members where organization_id = p_org and user_id = auth.uid());
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organization_members
                 where organization_id = p_org and user_id = auth.uid() and member_role in ('owner', 'admin'));
$$;

-- Organizations & clinics: public read; members manage.
grant select on public.organizations, public.clinics to anon, authenticated;
grant insert (name, slug, org_type, website) on public.organizations to authenticated;
grant update (name, org_type, website) on public.organizations to authenticated;
grant insert (organization_id, name, phone, website) on public.clinics to authenticated;
grant update (name, phone, website) on public.clinics to authenticated;
grant select on public.organization_members to authenticated;

create policy organizations_read on public.organizations for select to anon, authenticated using (true);
create policy organizations_insert on public.organizations for insert to authenticated
  with check (created_by = auth.uid() and public.current_app_role() = 'provider');
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_org_admin(organizations.id));
create policy organization_members_read on public.organization_members for select to authenticated
  using (user_id = auth.uid() or public.is_admin() or public.is_org_member(organization_members.organization_id));
create policy clinics_read on public.clinics for select to anon, authenticated using (true);
create policy clinics_insert on public.clinics for insert to authenticated
  with check (organization_id is not null and public.is_org_admin(clinics.organization_id));
create policy clinics_update on public.clinics for update to authenticated
  using (public.is_org_admin(clinics.organization_id));

-- Organization creator becomes owner.
alter table public.organizations alter column created_by set default auth.uid();
create or replace function public.handle_new_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_members (organization_id, user_id, member_role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger organizations_after_insert after insert on public.organizations
  for each row execute function public.handle_new_organization();

-- Provider profiles
grant select on public.provider_profiles to anon, authenticated;
grant update (display_name, honorific, post_nominals, pronouns, profession_id, headline, bio,
  languages, offers_virtual, offers_in_person, accepting_new_patients, payment_options,
  insurance_notes, clinic_id, is_published, onboarding_completed_at)
  on public.provider_profiles to authenticated;

create policy provider_profiles_read_anon on public.provider_profiles for select to anon
  using (public.provider_is_public(id));
create policy provider_profiles_read_auth on public.provider_profiles for select to authenticated
  using (public.provider_is_public(id) or user_id = auth.uid() or public.is_admin());
create policy provider_profiles_update_own on public.provider_profiles for update to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid());

-- Provider specialties / services / locations / availability:
-- public when the provider is public; owner manages.
grant select on public.provider_specialties, public.services, public.locations, public.availability
  to anon, authenticated;
grant insert, delete on public.provider_specialties to authenticated;
grant update (is_primary) on public.provider_specialties to authenticated;
grant insert, delete on public.services to authenticated;
grant update (name, description, modality, duration_minutes, fee_note, is_active) on public.services to authenticated;
grant insert, delete on public.locations to authenticated;
grant update (label, address_line1, address_line2, city, region, country, postal_code, latitude, longitude)
  on public.locations to authenticated;
grant insert, delete on public.availability to authenticated;
grant update (weekday, start_time, end_time, timezone, modality, location_id) on public.availability to authenticated;

create policy provider_specialties_read_anon on public.provider_specialties for select to anon
  using (public.provider_is_public(provider_id));
create policy provider_specialties_read_auth on public.provider_specialties for select to authenticated
  using (public.provider_is_public(provider_id) or public.owns_provider(provider_id) or public.is_admin());
create policy provider_specialties_write on public.provider_specialties for all to authenticated
  using (public.owns_provider(provider_id)) with check (public.owns_provider(provider_id));

create policy services_read_anon on public.services for select to anon
  using (is_active and public.provider_is_public(provider_id));
create policy services_read_auth on public.services for select to authenticated
  using ((is_active and public.provider_is_public(provider_id)) or public.owns_provider(provider_id) or public.is_admin());
create policy services_write on public.services for all to authenticated
  using (public.owns_provider(provider_id)) with check (public.owns_provider(provider_id));

create policy locations_read_anon on public.locations for select to anon
  using (provider_id is null or public.provider_is_public(provider_id));
create policy locations_read_auth on public.locations for select to authenticated
  using (provider_id is null or public.provider_is_public(provider_id)
         or public.owns_provider(provider_id) or public.is_admin());
create policy locations_write on public.locations for all to authenticated
  using (provider_id is not null and public.owns_provider(provider_id))
  with check (provider_id is not null and public.owns_provider(provider_id));

create policy availability_read_anon on public.availability for select to anon
  using (public.provider_is_public(provider_id));
create policy availability_read_auth on public.availability for select to authenticated
  using (public.provider_is_public(provider_id) or public.owns_provider(provider_id) or public.is_admin());
create policy availability_write on public.availability for all to authenticated
  using (public.owns_provider(provider_id)) with check (public.owns_provider(provider_id));

-- Credentials: owner + admins only. Never anon.
grant select, insert, delete on public.provider_credentials to authenticated;
grant update (credential_type, issuing_body, jurisdiction, credential_number, expires_on, document_path)
  on public.provider_credentials to authenticated;
create policy provider_credentials_read on public.provider_credentials for select to authenticated
  using (public.owns_provider(provider_id) or public.has_admin_role('verifier'));
create policy provider_credentials_write on public.provider_credentials for all to authenticated
  using (public.owns_provider(provider_id)) with check (public.owns_provider(provider_id));

-- Verifications: owner reads own history; verifiers read all; writes via functions.
grant select on public.provider_verifications to authenticated;
create policy provider_verifications_read on public.provider_verifications for select to authenticated
  using (public.owns_provider(provider_id) or public.has_admin_role('verifier'));

-- Patient profiles: owner only.
grant select on public.patient_profiles to authenticated;
grant update (pronouns, city, region, country, preferred_languages, care_modality_preference,
  payment_preferences, insurance_note, onboarding_completed_at) on public.patient_profiles to authenticated;
create policy patient_profiles_owner_read on public.patient_profiles for select to authenticated
  using (user_id = auth.uid());
create policy patient_profiles_owner_update on public.patient_profiles for update to authenticated
  using (user_id = auth.uid() and public.is_active_user()) with check (user_id = auth.uid());

grant select, insert, delete on public.patient_specialty_interests to authenticated;
create policy patient_specialty_interests_owner on public.patient_specialty_interests for all to authenticated
  using (patient_id = auth.uid()) with check (patient_id = auth.uid());

grant select, insert, delete on public.saved_providers to authenticated;
create policy saved_providers_owner_read on public.saved_providers for select to authenticated
  using (patient_id = auth.uid());
create policy saved_providers_owner_insert on public.saved_providers for insert to authenticated
  with check (patient_id = auth.uid() and public.current_app_role() = 'patient'
              and public.provider_is_public(provider_id));
create policy saved_providers_owner_delete on public.saved_providers for delete to authenticated
  using (patient_id = auth.uid());

-- updated_at triggers
create trigger organizations_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger clinics_updated_at before update on public.clinics for each row execute function public.set_updated_at();
create trigger provider_profiles_updated_at before update on public.provider_profiles for each row execute function public.set_updated_at();
create trigger provider_credentials_updated_at before update on public.provider_credentials for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger locations_updated_at before update on public.locations for each row execute function public.set_updated_at();
create trigger patient_profiles_updated_at before update on public.patient_profiles for each row execute function public.set_updated_at();

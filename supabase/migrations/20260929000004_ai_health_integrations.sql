-- =============================================================================
-- Kora Health — Kora AI conversations, patient-managed health information,
-- connected-health integration framework (catalog, connections, permissions).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Kora AI
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  -- Safety classifier output, e.g. {emergency, crisis_self_harm, medication_change}.
  safety_flags text[] not null default '{}',
  model text check (char_length(model) <= 80),
  created_at timestamptz not null default now()
);
create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_flags_idx on public.ai_messages using gin (safety_flags);

create trigger ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();

create or replace function public.owns_ai_conversation(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.ai_conversations where id = p_conversation and user_id = auth.uid());
$$;

-- Aggregate-only safety monitoring for admins. Never returns content.
create or replace function public.admin_ai_safety_summary(p_days integer default 30)
returns table (flag text, occurrences bigint, last_seen timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_admin_role('moderator') then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  return query
    select f.flag, count(*)::bigint, max(m.created_at)
    from public.ai_messages m, unnest(m.safety_flags) as f(flag)
    where m.created_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
    group by f.flag
    order by 2 desc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Patient-managed health information (owner only).
-- ---------------------------------------------------------------------------
create table public.health_data (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.users (id) on delete cascade,
  category text not null check (category in (
    'condition', 'allergy', 'medication', 'immunization', 'measurement', 'procedure', 'note')),
  label text not null check (char_length(label) between 1 and 200),
  value text check (char_length(value) <= 500),
  unit text check (char_length(unit) <= 30),
  recorded_on date check (recorded_on <= current_date + 1),
  source text not null default 'manual' check (source ~ '^[a-z0-9_-]+$'),
  connection_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index health_data_patient_idx on public.health_data (patient_id, category, recorded_on desc);
create trigger health_data_updated_at before update on public.health_data
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Integrations framework.
-- Catalog rows describe potential integrations. A connection can only be
-- created when the catalog status is 'available' — no integration is marked
-- available until it is actually implemented end-to-end.
-- ---------------------------------------------------------------------------
create table public.integrations (
  slug text primary key check (slug ~ '^[a-z0-9_-]+$'),
  name text not null,
  category text not null check (category in ('wearable', 'platform_health', 'ehr', 'lab', 'pharmacy', 'scheduling')),
  description text not null,
  status text not null default 'coming_soon' check (status in ('available', 'coming_soon', 'disabled')),
  -- [{ "scope": "...", "description": "...", "data_categories": [...] }]
  scopes jsonb not null default '[]'::jsonb,
  sort_order smallint not null default 100
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  integration_slug text not null references public.integrations (slug),
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_synced_at timestamptz
);
create unique index integration_connections_active_idx
  on public.integration_connections (user_id, integration_slug) where status = 'active';

alter table public.health_data
  add constraint health_data_connection_fk foreign key (connection_id)
  references public.integration_connections (id) on delete cascade;

create table public.integration_permissions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  scope text not null check (char_length(scope) <= 80),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (connection_id, scope)
);

-- OAuth tokens for live integrations. Service-role only; never exposed to
-- clients. Values must be encrypted by the application (or Supabase Vault)
-- before storage.
create table public.integration_credentials (
  connection_id uuid primary key references public.integration_connections (id) on delete cascade,
  encrypted_payload text not null,
  key_version smallint not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.connect_integration(p_slug text, p_scopes text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_integration record;
  v_id uuid;
  v_scope text;
begin
  if public.current_app_role() is distinct from 'patient' then
    raise exception 'only patient accounts can connect health data' using errcode = '42501';
  end if;
  select * into v_integration from public.integrations where slug = p_slug;
  if not found then
    raise exception 'integration not found' using errcode = 'P0002';
  end if;
  if v_integration.status <> 'available' then
    raise exception 'integration is not available yet' using errcode = '22023';
  end if;
  if not public.has_consent(auth.uid(), 'health_data_storage') then
    raise exception 'health data storage consent required' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_scopes), 0) = 0 then
    raise exception 'select at least one permission' using errcode = '22023';
  end if;
  foreach v_scope in array p_scopes loop
    if not exists (select 1 from jsonb_array_elements(v_integration.scopes) s where s ->> 'scope' = v_scope) then
      raise exception 'unknown permission %', v_scope using errcode = '22023';
    end if;
  end loop;

  insert into public.integration_connections (user_id, integration_slug)
  values (auth.uid(), p_slug) returning id into v_id;
  insert into public.integration_permissions (connection_id, scope)
  select v_id, unnest(p_scopes);
  perform public.write_audit('integration.connected', 'integration', p_slug, auth.uid(),
    jsonb_build_object('connection_id', v_id, 'scopes', p_scopes));
  return v_id;
end;
$$;

create or replace function public.revoke_integration_scope(p_connection uuid, p_scope text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.integration_permissions ip set revoked_at = now()
  from public.integration_connections c
  where ip.connection_id = c.id and c.id = p_connection and c.user_id = auth.uid()
    and ip.scope = p_scope and ip.revoked_at is null;
  if not found then
    raise exception 'permission not found' using errcode = 'P0002';
  end if;
  perform public.write_audit('integration.scope_revoked', 'integration_connection', p_connection::text, auth.uid(),
    jsonb_build_object('scope', p_scope));
end;
$$;

-- Disconnect: revokes all permissions, deletes stored credentials, and
-- optionally deletes data imported through the connection.
create or replace function public.disconnect_integration(p_connection uuid, p_delete_data boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_deleted integer := 0;
begin
  select integration_slug into v_slug from public.integration_connections
  where id = p_connection and user_id = auth.uid() and status <> 'revoked'
  for update;
  if v_slug is null then
    raise exception 'connection not found' using errcode = 'P0002';
  end if;
  update public.integration_connections set status = 'revoked', revoked_at = now() where id = p_connection;
  update public.integration_permissions set revoked_at = now() where connection_id = p_connection and revoked_at is null;
  delete from public.integration_credentials where connection_id = p_connection;
  if p_delete_data then
    delete from public.health_data where connection_id = p_connection and patient_id = auth.uid();
    get diagnostics v_deleted = row_count;
  end if;
  perform public.write_audit('integration.disconnected', 'integration', v_slug, auth.uid(),
    jsonb_build_object('connection_id', p_connection, 'deleted_records', v_deleted));
end;
$$;

-- Audit health-data changes (no values are logged, only ids/categories).
create or replace function public.health_data_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.write_audit('health_data.' || lower(tg_op), 'health_data',
    coalesce(new.id, old.id)::text, coalesce(new.patient_id, old.patient_id),
    jsonb_build_object('category', coalesce(new.category, old.category)));
  return coalesce(new, old);
end;
$$;
create trigger health_data_audit after insert or update or delete on public.health_data
  for each row execute function public.health_data_audit();

-- ---------------------------------------------------------------------------
-- RLS & privileges
-- ---------------------------------------------------------------------------
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.health_data enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_connections enable row level security;
alter table public.integration_permissions enable row level security;
alter table public.integration_credentials enable row level security;

revoke all on public.ai_conversations, public.ai_messages, public.health_data, public.integrations,
  public.integration_connections, public.integration_permissions, public.integration_credentials
  from anon, authenticated;

grant select, delete on public.ai_conversations to authenticated;
grant insert (title) on public.ai_conversations to authenticated;
grant update (title) on public.ai_conversations to authenticated;
alter table public.ai_conversations alter column user_id set default auth.uid();
create policy ai_conversations_owner on public.ai_conversations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_active_user());

-- AI messages are written by the server (service role) after safety checks;
-- users can read their own.
grant select on public.ai_messages to authenticated;
create policy ai_messages_owner_read on public.ai_messages for select to authenticated
  using (public.owns_ai_conversation(conversation_id));

grant select, delete on public.health_data to authenticated;
grant insert (category, label, value, unit, recorded_on) on public.health_data to authenticated;
grant update (category, label, value, unit, recorded_on) on public.health_data to authenticated;
alter table public.health_data alter column patient_id set default auth.uid();
create policy health_data_owner_read on public.health_data for select to authenticated
  using (patient_id = auth.uid());
create policy health_data_owner_insert on public.health_data for insert to authenticated
  with check (patient_id = auth.uid() and public.current_app_role() = 'patient'
              and public.has_consent(auth.uid(), 'health_data_storage'));
create policy health_data_owner_update on public.health_data for update to authenticated
  using (patient_id = auth.uid()) with check (patient_id = auth.uid());
create policy health_data_owner_delete on public.health_data for delete to authenticated
  using (patient_id = auth.uid());

grant select on public.integrations to anon, authenticated;
create policy integrations_read on public.integrations for select to anon, authenticated using (true);

grant select on public.integration_connections, public.integration_permissions to authenticated;
create policy integration_connections_owner on public.integration_connections for select to authenticated
  using (user_id = auth.uid());
create policy integration_permissions_owner on public.integration_permissions for select to authenticated
  using (exists (select 1 from public.integration_connections c
                 where c.id = connection_id and c.user_id = auth.uid()));
-- integration_credentials: no client access at all.

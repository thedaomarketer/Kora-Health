-- =============================================================================
-- Kora Health — Admin event recording and integration monitoring.
-- =============================================================================

-- Admins record sensitive reads (e.g. viewing credentials or searching users)
-- in the audit log. Only admins can call it, and the action is always
-- namespaced under admin.*.
create or replace function public.admin_record_event(
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_subject uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  if p_action !~ '^[a-z_]+$' then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  perform public.write_audit('admin.' || p_action, p_target_type, p_target_id, p_subject, p_metadata);
end;
$$;

-- Connection counts per integration (no user-level data).
create or replace function public.admin_integration_stats()
returns table (slug text, name text, status text, active_connections bigint, revoked_connections bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'admin role required' using errcode = '42501';
  end if;
  return query
    select i.slug, i.name, i.status,
           count(c.id) filter (where c.status = 'active'),
           count(c.id) filter (where c.status = 'revoked')
      from public.integrations i
      left join public.integration_connections c on c.integration_slug = i.slug
     group by i.slug, i.name, i.status, i.sort_order
     order by i.sort_order;
end;
$$;

revoke execute on function public.admin_record_event(text, text, text, uuid, jsonb) from public, anon;
revoke execute on function public.admin_integration_stats() from public, anon;
grant execute on function public.admin_record_event(text, text, text, uuid, jsonb) to authenticated;
grant execute on function public.admin_integration_stats() to authenticated;

-- =============================================================================
-- Kora Health — Public open-slot lookup.
-- Returns bookable start times for a public provider, derived from weekly
-- availability minus confirmed appointments. Exposes only times — never who
-- booked them. Uses the same rules as create_appointment_request.
-- =============================================================================

create or replace function public.provider_open_slots(
  p_provider_id uuid,
  p_duration_minutes integer default 30,
  p_days integer default 14,
  p_modality public.visit_modality default null
)
returns table (starts_at timestamptz, ends_at timestamptz, modality public.care_modality)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_duration interval := make_interval(mins => least(greatest(coalesce(p_duration_minutes, 30), 10), 240));
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 60);
begin
  if not public.provider_is_public(p_provider_id) and not public.owns_provider(p_provider_id) then
    return;
  end if;

  return query
  with days as (
    select d::date as day
    from generate_series(current_date - 1, current_date + v_days, interval '1 day') d
  ),
  windows as (
    select a.timezone, a.modality,
           ((dy.day + a.start_time) at time zone a.timezone) as w_start,
           ((dy.day + a.end_time) at time zone a.timezone) as w_end
    from public.availability a
    join days dy on extract(dow from dy.day)::int = a.weekday
    where a.provider_id = p_provider_id
      and (p_modality is null or a.modality = 'both' or a.modality::text = p_modality::text)
  ),
  candidates as (
    select distinct on (s) s as slot_start, s + v_duration as slot_end, w.modality
    from windows w,
         generate_series(w.w_start, w.w_end - v_duration, interval '30 minutes') s
    order by s, w.modality
  )
  select c.slot_start, c.slot_end, c.modality
  from candidates c
  where c.slot_start >= now() + interval '1 hour'
    and c.slot_start <= now() + make_interval(days => v_days)
    and not exists (
      select 1 from public.appointments ap
      where ap.provider_id = p_provider_id and ap.status = 'confirmed'
        and tstzrange(ap.starts_at, ap.ends_at) && tstzrange(c.slot_start, c.slot_end)
    )
  order by c.slot_start
  limit 500;
end;
$$;

revoke execute on function public.provider_open_slots(uuid, integer, integer, public.visit_modality) from public;
grant execute on function public.provider_open_slots(uuid, integer, integer, public.visit_modality) to anon, authenticated;

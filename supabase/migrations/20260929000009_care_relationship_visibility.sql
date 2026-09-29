-- =============================================================================
-- Kora Health — Patients keep seeing providers they have a care relationship
-- with (requests, appointments, conversations), even if the provider later
-- unpublishes their profile. Without this, a patient's own appointment
-- history would lose the provider's name, service and location.
-- =============================================================================

create or replace function public.has_care_relationship(p_provider_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.appointment_requests where provider_id = p_provider_id and patient_id = auth.uid())
      or exists (select 1 from public.appointments where provider_id = p_provider_id and patient_id = auth.uid())
      or exists (select 1 from public.conversations where provider_id = p_provider_id and patient_id = auth.uid());
$$;

revoke execute on function public.has_care_relationship(uuid) from public, anon;
grant execute on function public.has_care_relationship(uuid) to authenticated;

create policy provider_profiles_read_related on public.provider_profiles for select to authenticated
  using (public.has_care_relationship(id));
create policy services_read_related on public.services for select to authenticated
  using (public.has_care_relationship(provider_id));
create policy locations_read_related on public.locations for select to authenticated
  using (provider_id is not null and public.has_care_relationship(provider_id));
create policy availability_read_related on public.availability for select to authenticated
  using (public.has_care_relationship(provider_id));

-- =============================================================================
-- Kora Health — Private storage buckets and final privilege lockdown.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Storage (only when running on Supabase, where the storage schema exists).
--   message-attachments/<conversation_id>/<uuid>.<ext>
--   provider-documents/<provider_id>/<uuid>.<ext>
-- Both buckets are private; files are served via short-lived signed URLs
-- generated server-side after an authorization check.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values
      ('message-attachments', 'message-attachments', false, 10485760,
       array['application/pdf', 'image/png', 'image/jpeg']),
      ('provider-documents', 'provider-documents', false, 10485760,
       array['application/pdf', 'image/png', 'image/jpeg'])
    on conflict (id) do nothing;

    execute $p$
      create policy "message attachments: participants read"
      on storage.objects for select to authenticated
      using (bucket_id = 'message-attachments'
             and public.is_conversation_participant(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "message attachments: participants upload"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'message-attachments'
                  and public.is_conversation_participant(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "provider documents: owner and verifiers read"
      on storage.objects for select to authenticated
      using (bucket_id = 'provider-documents'
             and (public.owns_provider(((storage.foldername(name))[1])::uuid)
                  or public.has_admin_role('verifier')))
    $p$;
    execute $p$
      create policy "provider documents: owner upload"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'provider-documents'
                  and public.owns_provider(((storage.foldername(name))[1])::uuid))
    $p$;
    execute $p$
      create policy "provider documents: owner delete"
      on storage.objects for delete to authenticated
      using (bucket_id = 'provider-documents'
             and public.owns_provider(((storage.foldername(name))[1])::uuid))
    $p$;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Function execution allowlist. Everything is revoked, then granted
-- explicitly. Internal helpers (write_audit, notify,
-- generate_appointment_reminders) are service-role only.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Used by anon-visible RLS policies.
grant execute on function public.provider_is_public(uuid) to anon, authenticated;

-- Used by authenticated RLS policies.
grant execute on function
  public.is_admin(),
  public.has_admin_role(public.admin_role),
  public.current_app_role(),
  public.is_active_user(),
  public.has_consent(uuid, text),
  public.owns_provider(uuid),
  public.current_provider_id(),
  public.is_org_member(uuid),
  public.is_org_admin(uuid),
  public.is_conversation_participant(uuid),
  public.owns_ai_conversation(uuid)
to authenticated;

-- RPCs callable by signed-in users (each enforces its own authorization).
grant execute on function
  public.record_audit_event(text, text, text, jsonb),
  public.check_rate_limit(text, integer, integer),
  public.create_provider_profile(text, text),
  public.submit_provider_verification(),
  public.review_provider_verification(uuid, text, text, jsonb),
  public.create_appointment_request(uuid, uuid, public.visit_modality, timestamptz, text, uuid),
  public.respond_to_appointment_request(uuid, boolean, text, uuid, text),
  public.withdraw_appointment_request(uuid),
  public.cancel_appointment(uuid, text),
  public.provider_update_appointment(uuid, public.appointment_status, text, text),
  public.start_conversation(uuid, uuid),
  public.mark_conversation_read(uuid),
  public.close_conversation(uuid),
  public.resolve_report(uuid, text, text),
  public.admin_get_reported_message(uuid),
  public.admin_ai_safety_summary(integer),
  public.connect_integration(text, text[]),
  public.revoke_integration_scope(uuid, text),
  public.disconnect_integration(uuid, boolean),
  public.admin_set_user_status(uuid, public.account_status, text),
  public.admin_suspend_provider(uuid, text),
  public.admin_grant_role(uuid, public.admin_role),
  public.admin_revoke_role(uuid),
  public.admin_platform_stats(),
  public.provider_stats()
to authenticated;

grant execute on function public.generate_appointment_reminders() to service_role;

-- Secure-by-default for anything added later: new tables and functions get
-- no anon/authenticated privileges until a migration grants them.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

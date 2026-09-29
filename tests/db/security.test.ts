import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DbHarness, TEST_DATABASE_URL, nextWeekdaySlot } from "./harness";

const d = TEST_DATABASE_URL ? describe : describe.skip;

d("database security & workflows", () => {
  const db = new DbHarness(TEST_DATABASE_URL ?? "");
  let patientA: string;
  let patientB: string;
  let providerUser: string;
  let otherProviderUser: string;
  let providerId: string;
  let otherProviderId: string;
  let verifier: string;
  let moderator: string;

  beforeAll(async () => {
    await db.setup();
    patientA = await db.createUser("patient", "Patient A");
    patientB = await db.createUser("patient", "Patient B");
    providerUser = await db.createUser("provider", "Dr Provider");
    otherProviderUser = await db.createUser("provider", "Other Provider");
    verifier = await db.createUser("patient", "Verifier");
    moderator = await db.createUser("patient", "Moderator");
    await db.makeAdmin(verifier, "verifier");
    await db.makeAdmin(moderator, "moderator");
  }, 60_000);

  afterAll(async () => {
    await db.teardown();
  });

  // ---------------------------------------------------------------- accounts
  describe("accounts & roles", () => {
    it("creates public.users rows with the requested role", async () => {
      const rows = await db.sql(`select role from public.users where id = $1`, [providerUser]);
      expect(rows[0].role).toBe("provider");
    });

    it("never grants admin or unknown roles from sign-up metadata", async () => {
      const id = crypto.randomUUID();
      await db.sql(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'x@example.test', '{"role":"admin"}')`, [id]);
      const rows = await db.sql(`select role from public.users where id = $1`, [id]);
      expect(rows[0].role).toBe("patient");
      const admins = await db.sql(`select * from public.administrators where user_id = $1`, [id]);
      expect(admins).toHaveLength(0);
    });

    it("prevents users from changing their own role or status", async () => {
      await expect(db.as(patientA, (q) => q(`update public.users set role = 'provider' where id = $1`, [patientA]))).rejects.toThrow(/permission denied/);
      await expect(db.as(patientA, (q) => q(`update public.users set status = 'active' where id = $1`, [patientA]))).rejects.toThrow(/permission denied/);
    });

    it("lets users edit their own display name only", async () => {
      await db.as(patientA, (q) => q(`update public.users set display_name = 'Patient A1' where id = $1`, [patientA]));
      const updated = await db.as(patientA, (q) => q(`update public.users set display_name = 'hack' where id = $1 returning id`, [patientB]));
      expect(updated).toHaveLength(0);
    });

    it("hides other users' rows", async () => {
      const rows = await db.as(patientA, (q) => q(`select id from public.users`));
      expect(rows.map((r) => r.id)).toEqual([patientA]);
    });

    it("prevents self-granting admin", async () => {
      await expect(db.as(patientA, (q) => q(`insert into public.administrators (user_id, admin_role) values ($1, 'superadmin')`, [patientA]))).rejects.toThrow(/permission denied/);
      await expect(db.as(patientA, (q) => q(`select public.admin_grant_role($1, 'superadmin')`, [patientA]))).rejects.toThrow(/superadmin role required/);
    });
  });

  // ------------------------------------------------------------- anon access
  describe("anonymous access", () => {
    it("can browse published sample providers and reference data", async () => {
      const providers = await db.as(null, (q) => q(`select id, is_demo, verification_status from public.provider_profiles`));
      expect(providers.length).toBeGreaterThan(5);
      expect(providers.every((p) => p.is_demo && p.verification_status === "pending")).toBe(true);
      const specs = await db.as(null, (q) => q(`select * from public.specialties`));
      expect(specs.length).toBeGreaterThan(10);
    });

    it("cannot read private tables", async () => {
      for (const table of ["users", "patient_profiles", "provider_credentials", "appointments", "messages", "audit_logs", "health_data", "consents", "ai_messages"]) {
        await expect(db.as(null, (q) => q(`select * from public.${table} limit 1`)), table).rejects.toThrow(/permission denied/);
      }
    });

    it("cannot call RPCs", async () => {
      await expect(db.as(null, (q) => q(`select public.admin_platform_stats()`))).rejects.toThrow(/permission denied/);
      await expect(db.as(null, (q) => q(`select public.submit_provider_verification()`))).rejects.toThrow(/permission denied/);
    });

    it("cannot call internal helpers even when signed in", async () => {
      await expect(db.as(patientA, (q) => q(`select public.write_audit('admin.fake', null, null, null, '{}')`))).rejects.toThrow(/permission denied/);
      await expect(db.as(patientA, (q) => q(`select public.notify($1, 'x', 'x', 'x', '/x')`, [patientB]))).rejects.toThrow(/permission denied/);
      await expect(db.as(patientA, (q) => q(`select public.generate_appointment_reminders()`))).rejects.toThrow(/permission denied/);
    });
  });

  // ------------------------------------------------------- provider workflow
  describe("provider onboarding & verification", () => {
    it("only provider accounts can create a provider profile", async () => {
      await expect(db.as(patientA, (q) => q(`select public.create_provider_profile('Fake Doctor', 'fake-doctor')`))).rejects.toThrow(/only provider accounts/);
      const [row] = await db.as(providerUser, (q) => q<{ id: string }>(`select public.create_provider_profile('Dr Provider', 'dr-provider-test') as id`));
      providerId = row.id;
      const [other] = await db.as(otherProviderUser, (q) => q<{ id: string }>(`select public.create_provider_profile('Other Provider', 'other-provider-test') as id`));
      otherProviderId = other.id;
      expect(providerId).toBeTruthy();
    });

    it("providers cannot set their own verification status", async () => {
      await expect(db.as(providerUser, (q) => q(`update public.provider_profiles set verification_status = 'verified' where id = $1`, [providerId]))).rejects.toThrow(/permission denied/);
      await expect(db.as(providerUser, (q) => q(`update public.provider_profiles set is_demo = true where id = $1`, [providerId]))).rejects.toThrow(/permission denied/);
    });

    it("cannot publish before onboarding requirements are met", async () => {
      await expect(db.as(providerUser, (q) => q(`update public.provider_profiles set onboarding_completed_at = now(), is_published = true where id = $1`, [providerId]))).rejects.toThrow(/profession/);
    });

    it("completes onboarding and publishes (still unlisted until submitted)", async () => {
      await db.as(providerUser, async (q) => {
        await q(`update public.provider_profiles set profession_id = (select id from public.professions where slug = 'physician'), offers_virtual = true, offers_in_person = true where id = $1`, [providerId]);
        await q(`insert into public.provider_specialties (provider_id, specialty_id, is_primary) values ($1, (select id from public.specialties where slug = 'primary-care'), true)`, [providerId]);
        await q(`insert into public.locations (provider_id, city, country) values ($1, 'Toronto', 'CA')`, [providerId]);
        await q(`insert into public.services (provider_id, name, modality, duration_minutes) values ($1, 'Consultation', 'both', 30)`, [providerId]);
        for (let day = 1; day <= 5; day++) {
          await q(`insert into public.availability (provider_id, weekday, start_time, end_time, timezone) values ($1, $2, '09:00', '17:00', 'America/Toronto')`, [providerId, day]);
        }
        await q(`update public.provider_profiles set onboarding_completed_at = now(), is_published = true where id = $1`, [providerId]);
      });
      // Published but unverified (nothing submitted) → hidden from the public.
      const visible = await db.as(null, (q) => q(`select id from public.provider_profiles where id = $1`, [providerId]));
      expect(visible).toHaveLength(0);
    });

    it("cannot write to another provider's profile or availability", async () => {
      const updated = await db.as(otherProviderUser, (q) => q(`update public.provider_profiles set bio = 'hacked' where id = $1 returning id`, [providerId]));
      expect(updated).toHaveLength(0);
      await expect(db.as(otherProviderUser, (q) => q(`insert into public.availability (provider_id, weekday, start_time, end_time) values ($1, 1, '09:00', '10:00')`, [providerId]))).rejects.toThrow(/row-level security/);
    });

    it("rejects invalid time zones", async () => {
      await expect(db.as(providerUser, (q) => q(`insert into public.availability (provider_id, weekday, start_time, end_time, timezone) values ($1, 6, '09:00', '10:00', 'Mars/Olympus')`, [providerId]))).rejects.toThrow(/unknown time zone/);
    });

    it("requires a license before submitting for verification", async () => {
      await expect(db.as(providerUser, (q) => q(`select public.submit_provider_verification()`))).rejects.toThrow(/license or registration/);
      await db.as(providerUser, (q) => q(`insert into public.provider_credentials (provider_id, credential_type, issuing_body, jurisdiction, credential_number) values ($1, 'license', 'College of Physicians and Surgeons of Ontario', 'Ontario, Canada', 'TEST-123')`, [providerId]));
      await db.as(providerUser, (q) => q(`select public.submit_provider_verification()`));
      const [p] = await db.sql(`select verification_status from public.provider_profiles where id = $1`, [providerId]);
      expect(p.verification_status).toBe("pending");
    });

    it("keeps credentials private", async () => {
      expect(await db.as(patientA, (q) => q(`select * from public.provider_credentials`))).toHaveLength(0);
      expect(await db.as(otherProviderUser, (q) => q(`select * from public.provider_credentials`))).toHaveLength(0);
      expect(await db.as(verifier, (q) => q(`select * from public.provider_credentials where provider_id = $1`, [providerId]))).toHaveLength(1);
    });

    it("only verifiers can review, and approval requires the full checklist", async () => {
      const [v] = await db.sql<{ id: string }>(`select id from public.provider_verifications where provider_id = $1 and status = 'submitted'`, [providerId]);
      await expect(db.as(moderator, (q) => q(`select public.review_provider_verification($1, 'approved', null, '{}')`, [v.id]))).rejects.toThrow(/verifier role required/);
      await expect(db.as(providerUser, (q) => q(`select public.review_provider_verification($1, 'approved', null, '{}')`, [v.id]))).rejects.toThrow(/verifier role required/);
      await expect(db.as(verifier, (q) => q(`select public.review_provider_verification($1, 'approved', null, '{"name_matches":true}')`, [v.id]))).rejects.toThrow(/checklist incomplete/);
      await db.as(verifier, (q) => q(`select public.review_provider_verification($1, 'approved', null, '{"license_found_in_public_register":true,"name_matches":true,"license_active":true,"jurisdiction_matches":true}')`, [v.id]));
      const [p] = await db.sql(`select verification_status, verified_at from public.provider_profiles where id = $1`, [providerId]);
      expect(p.verification_status).toBe("verified");
      expect(p.verified_at).not.toBeNull();
      const audit = await db.sql(`select * from public.audit_logs where action = 'admin.verification_approved' and target_id = $1`, [v.id]);
      expect(audit).toHaveLength(1);
      expect(audit[0].actor_id).toBe(verifier);
    });

    it("resets verification when credentials change afterwards", async () => {
      await db.as(providerUser, (q) => q(`update public.provider_credentials set credential_number = 'CHANGED' where provider_id = $1`, [providerId]));
      const [p] = await db.sql(`select verification_status from public.provider_profiles where id = $1`, [providerId]);
      expect(p.verification_status).toBe("pending");
      // Re-approve for the remaining tests.
      const [v] = await db.sql<{ id: string }>(`select id from public.provider_verifications where provider_id = $1 and status = 'submitted'`, [providerId]);
      await db.as(verifier, (q) => q(`select public.review_provider_verification($1, 'approved', null, '{"license_found_in_public_register":true,"name_matches":true,"license_active":true,"jurisdiction_matches":true}')`, [v.id]));
    });

    it("is now publicly visible", async () => {
      const visible = await db.as(null, (q) => q(`select id, verification_status from public.provider_profiles where id = $1`, [providerId]));
      expect(visible[0]?.verification_status).toBe("verified");
    });
  });

  // ------------------------------------------------------------ appointments
  describe("appointments", () => {
    let requestId: string;
    let appointmentId: string;
    let slot: string;

    it("only patients can request, and only within availability", async () => {
      slot = await nextWeekdaySlot(db, "America/Toronto", 10);
      await expect(db.as(otherProviderUser, (q) => q(`select public.create_appointment_request($1, null, 'virtual', $2, 'hi', null)`, [providerId, slot]))).rejects.toThrow(/only patient accounts/);
      const nightSlot = await nextWeekdaySlot(db, "America/Toronto", 22);
      await expect(db.as(patientA, (q) => q(`select public.create_appointment_request($1, null, 'virtual', $2, null, null)`, [providerId, nightSlot]))).rejects.toThrow(/outside the provider's availability/);
      await expect(db.as(patientA, (q) => q(`select public.create_appointment_request($1, null, 'virtual', now() - interval '1 day', null, null)`, [providerId]))).rejects.toThrow(/in advance/);
      const [r] = await db.as(patientA, (q) => q<{ id: string }>(`select public.create_appointment_request($1, null, 'virtual', $2, 'Checkup', null) as id`, [providerId, slot]));
      requestId = r.id;
    });

    it("notifies the provider without leaking the patient note", async () => {
      const notes = await db.as(providerUser, (q) => q(`select title, body from public.notifications`));
      expect(notes.some((n) => n.title === "New appointment request")).toBe(true);
      expect(notes.every((n) => !String(n.body).includes("Checkup"))).toBe(true);
    });

    it("is visible only to the two parties", async () => {
      expect(await db.as(patientA, (q) => q(`select id from public.appointment_requests`))).toHaveLength(1);
      expect(await db.as(providerUser, (q) => q(`select id from public.appointment_requests`))).toHaveLength(1);
      expect(await db.as(patientB, (q) => q(`select id from public.appointment_requests`))).toHaveLength(0);
      expect(await db.as(otherProviderUser, (q) => q(`select id from public.appointment_requests`))).toHaveLength(0);
    });

    it("cannot be accepted by another provider or modified directly", async () => {
      await expect(db.as(otherProviderUser, (q) => q(`select public.respond_to_appointment_request($1, true, null, null, null)`, [requestId]))).rejects.toThrow(/request not found/);
      await expect(db.as(patientA, (q) => q(`update public.appointment_requests set status = 'accepted' where id = $1`, [requestId]))).rejects.toThrow(/permission denied/);
    });

    it("provider accepts and an appointment is created", async () => {
      const [r] = await db.as(providerUser, (q) => q<{ id: string }>(`select public.respond_to_appointment_request($1, true, 'See you then', null, 'https://meet.example.test/abc') as id`, [requestId]));
      appointmentId = r.id;
      const appts = await db.as(patientA, (q) => q(`select status, virtual_visit_url from public.appointments`));
      expect(appts[0]).toMatchObject({ status: "confirmed", virtual_visit_url: "https://meet.example.test/abc" });
    });

    it("prevents double-booking the same slot", async () => {
      await expect(db.as(patientB, (q) => q(`select public.create_appointment_request($1, null, 'virtual', $2, null, null)`, [providerId, slot]))).rejects.toThrow(/no longer available/);
    });

    it("supports rescheduling", async () => {
      const newSlot = await nextWeekdaySlot(db, "America/Toronto", 14);
      const [r] = await db.as(patientA, (q) => q<{ id: string }>(`select public.create_appointment_request($1, null, 'virtual', $2, null, $3) as id`, [providerId, newSlot, appointmentId]));
      const [a] = await db.as(providerUser, (q) => q<{ id: string }>(`select public.respond_to_appointment_request($1, true, null, null, null) as id`, [r.id]));
      const [old] = await db.sql(`select status from public.appointments where id = $1`, [appointmentId]);
      expect(old.status).toBe("rescheduled");
      appointmentId = a.id;
    });

    it("lets either party cancel and notifies the other", async () => {
      await expect(db.as(patientB, (q) => q(`select public.cancel_appointment($1, 'x')`, [appointmentId]))).rejects.toThrow(/not found/);
      await db.as(patientA, (q) => q(`select public.cancel_appointment($1, 'Conflict')`, [appointmentId]));
      const [a] = await db.sql(`select status from public.appointments where id = $1`, [appointmentId]);
      expect(a.status).toBe("cancelled_by_patient");
      const notes = await db.as(providerUser, (q) => q(`select kind from public.notifications where kind = 'appointment.cancelled'`));
      expect(notes).toHaveLength(1);
    });
  });

  // --------------------------------------------------------- slots & visibility
  describe("open slots and care-relationship visibility", () => {
    it("exposes only times (never patients) for public providers", async () => {
      const slots = await db.as(null, (q) => q(`select * from public.provider_open_slots($1, 30, 14)`, [providerId]));
      expect(slots.length).toBeGreaterThan(0);
      expect(Object.keys(slots[0]).sort()).toEqual(["ends_at", "modality", "starts_at"]);
      const hidden = await db.as(null, (q) => q(`select * from public.provider_open_slots($1, 30, 14)`, [otherProviderId]));
      expect(hidden).toHaveLength(0);
    });

    it("keeps an unpublished provider visible to their existing patients only", async () => {
      await db.as(providerUser, (q) => q(`update public.provider_profiles set is_published = false where id = $1`, [providerId]));
      expect(await db.as(null, (q) => q(`select id from public.provider_profiles where id = $1`, [providerId]))).toHaveLength(0);
      expect(await db.as(patientB, (q) => q(`select id from public.provider_profiles where id = $1`, [providerId]))).toHaveLength(0);
      expect(await db.as(patientA, (q) => q(`select id from public.provider_profiles where id = $1`, [providerId]))).toHaveLength(1);
      await db.as(providerUser, (q) => q(`update public.provider_profiles set is_published = true where id = $1`, [providerId]));
    });
  });

  // --------------------------------------------------------------- messaging
  describe("messaging", () => {
    let conversationId: string;

    it("requires an existing care relationship", async () => {
      await expect(db.as(patientB, (q) => q(`select public.start_conversation($1, null)`, [providerId]))).rejects.toThrow(/after an appointment request/);
      const [c] = await db.as(patientA, (q) => q<{ id: string }>(`select public.start_conversation($1, null) as id`, [providerId]));
      conversationId = c.id;
    });

    it("lets participants exchange messages", async () => {
      await db.as(patientA, (q) => q(`insert into public.messages (conversation_id, body) values ($1, 'Hello doctor')`, [conversationId]));
      await db.as(providerUser, (q) => q(`insert into public.messages (conversation_id, body) values ($1, 'Hello!')`, [conversationId]));
      expect(await db.as(providerUser, (q) => q(`select * from public.messages`))).toHaveLength(2);
    });

    it("blocks outsiders from reading or posting", async () => {
      expect(await db.as(patientB, (q) => q(`select * from public.messages`))).toHaveLength(0);
      expect(await db.as(otherProviderUser, (q) => q(`select * from public.conversations`))).toHaveLength(0);
      await expect(db.as(patientB, (q) => q(`insert into public.messages (conversation_id, body) values ($1, 'spam')`, [conversationId]))).rejects.toThrow(/row-level security/);
      expect(await db.as(verifier, (q) => q(`select * from public.messages`))).toHaveLength(0);
    });

    it("prevents spoofing the sender", async () => {
      await expect(db.as(patientA, (q) => q(`insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'fake')`, [conversationId, providerUser]))).rejects.toThrow(/permission denied/);
    });

    it("sends content-free notifications and tracks read status", async () => {
      const notes = await db.as(providerUser, (q) => q(`select body from public.notifications where kind = 'message.received'`));
      expect(notes).toHaveLength(1);
      expect(notes[0].body).not.toContain("Hello doctor");
      await db.as(providerUser, (q) => q(`select public.mark_conversation_read($1)`, [conversationId]));
      const unread = await db.sql(`select count(*)::int as n from public.messages where conversation_id = $1 and sender_id = $2 and read_at is null`, [conversationId, patientA]);
      expect(unread[0].n).toBe(0);
    });

    it("supports reporting and moderator-only access to the reported message", async () => {
      const [m] = await db.sql<{ id: string }>(`select id from public.messages where sender_id = $1 limit 1`, [providerUser]);
      await expect(db.as(patientB, (q) => q(`insert into public.reports (target_type, target_id, reason) values ('message', $1, 'harassment')`, [m.id]))).rejects.toThrow(/message not found/);
      const [r] = await db.as(patientA, (q) => q<{ id: string }>(`insert into public.reports (target_type, target_id, reason) values ('message', $1, 'harassment') returning id`, [m.id]));
      await expect(db.as(patientA, (q) => q(`select * from public.admin_get_reported_message($1)`, [r.id]))).rejects.toThrow(/moderator role required/);
      const rows = await db.as(moderator, (q) => q(`select * from public.admin_get_reported_message($1)`, [r.id]));
      expect(rows[0].body).toBe("Hello!");
      await db.as(moderator, (q) => q(`select public.resolve_report($1, 'dismissed', 'ok')`, [r.id]));
    });

    it("blocks suspended users from messaging", async () => {
      await db.as(moderator, (q) => q(`select public.admin_set_user_status($1, 'suspended', 'test')`, [patientA]));
      await expect(db.as(patientA, (q) => q(`insert into public.messages (conversation_id, body) values ($1, 'still here')`, [conversationId]))).rejects.toThrow(/row-level security/);
      await db.as(moderator, (q) => q(`select public.admin_set_user_status($1, 'active', 'restored')`, [patientA]));
    });
  });

  // ---------------------------------------------------- health data & consent
  describe("health data, consent & integrations", () => {
    it("requires consent before storing health data", async () => {
      await expect(db.as(patientA, (q) => q(`insert into public.health_data (category, label) values ('allergy', 'Penicillin')`))).rejects.toThrow(/row-level security/);
      await db.as(patientA, (q) => q(`insert into public.consents (user_id, consent_type, version, granted) values ($1, 'health_data_storage', '2026-09', true)`, [patientA]));
      await db.as(patientA, (q) => q(`insert into public.health_data (category, label) values ('allergy', 'Penicillin')`));
    });

    it("keeps health data private to the patient (including from admins and providers)", async () => {
      expect(await db.as(patientA, (q) => q(`select * from public.health_data`))).toHaveLength(1);
      expect(await db.as(providerUser, (q) => q(`select * from public.health_data`))).toHaveLength(0);
      expect(await db.as(moderator, (q) => q(`select * from public.health_data`))).toHaveLength(0);
    });

    it("prevents consent forgery for other users", async () => {
      await expect(db.as(patientB, (q) => q(`insert into public.consents (user_id, consent_type, version, granted) values ($1, 'ai_assistant', '1', true)`, [patientA]))).rejects.toThrow(/row-level security/);
    });

    it("refuses to connect integrations that are not implemented", async () => {
      await expect(db.as(patientA, (q) => q(`select public.connect_integration('apple_health', array['activity.read'])`))).rejects.toThrow(/not available yet/);
    });

    it("records access history visible to the subject", async () => {
      const rows = await db.as(patientA, (q) => q(`select action from public.audit_logs`));
      const actions = rows.map((r) => r.action);
      expect(actions).toContain("consent.granted");
      expect(actions).toContain("health_data.insert");
      expect(await db.as(patientB, (q) => q(`select * from public.audit_logs where subject_user_id = $1`, [patientA]))).toHaveLength(0);
    });

    it("keeps audit logs append-only", async () => {
      await expect(db.as(patientA, (q) => q(`delete from public.audit_logs`))).rejects.toThrow(/permission denied/);
      await expect(db.sql(`delete from public.audit_logs`)).rejects.toThrow(/append-only/);
      await expect(db.as(patientA, (q) => q(`select public.record_audit_event('admin.fake')`))).rejects.toThrow(/reserved/);
    });
  });

  // -------------------------------------------------------------- AI & misc
  describe("AI, rate limits & admin", () => {
    it("users cannot write AI messages directly (server-only)", async () => {
      const [c] = await db.as(patientA, (q) => q<{ id: string }>(`insert into public.ai_conversations (title) values ('Test') returning id`));
      await expect(db.as(patientA, (q) => q(`insert into public.ai_messages (conversation_id, role, content) values ($1, 'assistant', 'I diagnose you')`, [c.id]))).rejects.toThrow(/permission denied/);
      expect(await db.as(patientB, (q) => q(`select * from public.ai_conversations`))).toHaveLength(0);
    });

    it("enforces per-user rate limits", async () => {
      const results = await db.as(patientA, async (q) => {
        const out: boolean[] = [];
        for (let i = 0; i < 4; i++) out.push((await q<{ ok: boolean }>(`select public.check_rate_limit('test', 3, 60) as ok`))[0].ok);
        return out;
      });
      expect(results).toEqual([true, true, true, false]);
      const other = await db.as(patientB, (q) => q<{ ok: boolean }>(`select public.check_rate_limit('test', 3, 60) as ok`));
      expect(other[0].ok).toBe(true);
    });

    it("restricts admin analytics to admins and returns counts only", async () => {
      await expect(db.as(patientA, (q) => q(`select public.admin_platform_stats()`))).rejects.toThrow(/admin role required/);
      const [row] = await db.as(moderator, (q) => q<{ s: Record<string, number> }>(`select public.admin_platform_stats() as s`));
      expect(row.s.patients).toBeGreaterThan(0);
    });

    it("protects admins from lower-privileged admins", async () => {
      await expect(db.as(moderator, (q) => q(`select public.admin_set_user_status($1, 'suspended', 'x')`, [verifier]))).rejects.toThrow(/superadmin required/);
      await expect(db.as(moderator, (q) => q(`select public.admin_set_user_status($1, 'suspended', 'x')`, [moderator]))).rejects.toThrow(/own status/);
    });
  });
});

-- =============================================================================
-- Kora Health — DEVELOPMENT SEED DATA ONLY.
--
-- Loaded by `supabase db reset` for local development. NEVER load into
-- production. Every profile here is fictional, flagged is_demo = true, shown
-- in the UI as "Sample profile — development data", and hidden entirely when
-- NEXT_PUBLIC_KORA_ENV=production.
--
-- Sample profiles are left in 'pending' verification on purpose: nothing
-- here has been verified, so nothing is displayed as verified. To see the
-- verified state locally, approve a profile through the admin workflow.
-- Sample accounts have no password and cannot sign in.
-- =============================================================================

do $$
declare
  v_seed jsonb := '[
    {"name":"Amara Okafor","hon":"Dr.","post":"MD, CCFP","prof":"physician","specs":["primary-care","womens-health"],
     "headline":"Family physician focused on preventive care","city":"Toronto","region":"ON","country":"CA","lat":43.6532,"lng":-79.3832,
     "langs":["en","fr"],"virtual":true,"inperson":true,"pay":["public_insurance"],"tz":"America/Toronto"},
    {"name":"Kwame Mensah","hon":"Dr.","post":"MD, FRCPC","prof":"physician","specs":["cardiology"],
     "headline":"Cardiologist — blood pressure and heart health","city":"Toronto","region":"ON","country":"CA","lat":43.6532,"lng":-79.3832,
     "langs":["en","tw"],"virtual":true,"inperson":true,"pay":["public_insurance"],"tz":"America/Toronto"},
    {"name":"Nia Thompson","hon":null,"post":"MSW, RSW","prof":"psychotherapist","specs":["mental-health","psychotherapy"],
     "headline":"Culturally responsive therapy for individuals and couples","city":"Brampton","region":"ON","country":"CA","lat":43.7315,"lng":-79.7624,
     "langs":["en"],"virtual":true,"inperson":false,"pay":["private_insurance","self_pay","sliding_scale"],"tz":"America/Toronto"},
    {"name":"Fatou Diallo","hon":null,"post":"RM","prof":"midwife","specs":["maternal-health"],
     "headline":"Midwife supporting pregnancy, birth and postpartum","city":"Montréal","region":"QC","country":"CA","lat":45.5019,"lng":-73.5674,
     "langs":["fr","en","wo"],"virtual":false,"inperson":true,"pay":["public_insurance"],"tz":"America/Toronto"},
    {"name":"Tobi Adeyemi","hon":null,"post":"RD","prof":"dietitian","specs":["nutrition","endocrinology"],
     "headline":"Dietitian for diabetes and heart-healthy eating","city":"Calgary","region":"AB","country":"CA","lat":51.0447,"lng":-114.0719,
     "langs":["en","yo"],"virtual":true,"inperson":true,"pay":["private_insurance","self_pay"],"tz":"America/Edmonton"},
    {"name":"Marcus Bell","hon":"Dr.","post":"DDS","prof":"dentist","specs":["dental"],
     "headline":"General and family dentistry","city":"Atlanta","region":"GA","country":"US","lat":33.749,"lng":-84.388,
     "langs":["en"],"virtual":false,"inperson":true,"pay":["private_insurance","self_pay"],"tz":"America/New_York"},
    {"name":"Imani Carter","hon":"Dr.","post":"PsyD","prof":"psychologist","specs":["mental-health"],
     "headline":"Clinical psychologist — anxiety, stress and life transitions","city":"Atlanta","region":"GA","country":"US","lat":33.749,"lng":-84.388,
     "langs":["en"],"virtual":true,"inperson":true,"pay":["private_insurance","self_pay"],"tz":"America/New_York"},
    {"name":"Kofi Boateng","hon":null,"post":"PharmD","prof":"pharmacist","specs":["pharmacy"],
     "headline":"Pharmacist offering medication reviews","city":"London","region":"England","country":"GB","lat":51.5072,"lng":-0.1276,
     "langs":["en","tw"],"virtual":true,"inperson":true,"pay":["self_pay"],"tz":"Europe/London"},
    {"name":"Zainab Hassan","hon":"Dr.","post":"MBBS","prof":"physician","specs":["hematology"],
     "headline":"Hematologist with a focus on sickle cell disease","city":"London","region":"England","country":"GB","lat":51.5072,"lng":-0.1276,
     "langs":["en","so","ar"],"virtual":true,"inperson":true,"pay":["public_insurance","private_insurance"],"tz":"Europe/London"},
    {"name":"Andre Williams","hon":null,"post":"PT, DPT","prof":"physiotherapist","specs":["rehabilitation","orthopedics"],
     "headline":"Physiotherapy for sports injuries and recovery","city":"Halifax","region":"NS","country":"CA","lat":44.6488,"lng":-63.5752,
     "langs":["en"],"virtual":false,"inperson":true,"pay":["private_insurance","self_pay"],"tz":"America/Halifax"},
    {"name":"Grace Mbeki","hon":"Dr.","post":"MD","prof":"physician","specs":["dermatology"],
     "headline":"Dermatologist — skin, hair and scalp conditions","city":"Vancouver","region":"BC","country":"CA","lat":49.2827,"lng":-123.1207,
     "langs":["en","zu"],"virtual":true,"inperson":true,"pay":["public_insurance"],"tz":"America/Vancouver"},
    {"name":"Jordan Ellis","hon":null,"post":"NP","prof":"nurse-practitioner","specs":["primary-care","sexual-health"],
     "headline":"Nurse practitioner — primary and sexual health care","city":"Ottawa","region":"ON","country":"CA","lat":45.4215,"lng":-75.6972,
     "langs":["en","fr"],"virtual":true,"inperson":true,"pay":["public_insurance"],"tz":"America/Toronto"}
  ]';
  v_item jsonb;
  v_user uuid;
  v_provider uuid;
  v_location uuid;
  v_slug text;
  v_idx integer := 0;
  v_spec text;
  v_first boolean;
  v_day integer;
begin
  for v_item in select * from jsonb_array_elements(v_seed) loop
    v_idx := v_idx + 1;
    v_user := gen_random_uuid();
    v_slug := regexp_replace(lower(translate(v_item ->> 'name', 'éÉ', 'eE')), '[^a-z0-9]+', '-', 'g') || '-sample';

    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated',
            'sample-provider-' || v_idx || '@example.invalid', '',
            jsonb_build_object('role', 'provider', 'display_name', v_item ->> 'name'));

    insert into public.provider_profiles (
      user_id, slug, display_name, honorific, post_nominals, profession_id, headline, bio, languages,
      offers_virtual, offers_in_person, accepting_new_patients, payment_options,
      verification_status, is_published, is_demo, onboarding_completed_at)
    values (
      v_user, v_slug, v_item ->> 'name', v_item ->> 'hon', v_item ->> 'post',
      (select id from public.professions where slug = v_item ->> 'prof'),
      v_item ->> 'headline',
      'This is a fictional sample profile used for development and testing. It does not represent a real healthcare professional.',
      array(select jsonb_array_elements_text(v_item -> 'langs')),
      (v_item ->> 'virtual')::boolean, (v_item ->> 'inperson')::boolean, v_idx % 4 <> 0,
      array(select jsonb_array_elements_text(v_item -> 'pay')),
      'pending', true, true, now())
    returning id into v_provider;

    v_first := true;
    for v_spec in select jsonb_array_elements_text(v_item -> 'specs') loop
      insert into public.provider_specialties (provider_id, specialty_id, is_primary)
      values (v_provider, (select id from public.specialties where slug = v_spec), v_first);
      v_first := false;
    end loop;

    insert into public.locations (provider_id, label, city, region, country, latitude, longitude)
    values (v_provider, 'Sample practice location', v_item ->> 'city', v_item ->> 'region',
            v_item ->> 'country', (v_item ->> 'lat')::float8, (v_item ->> 'lng')::float8)
    returning id into v_location;

    insert into public.services (provider_id, name, description, modality, duration_minutes)
    values
      (v_provider, 'New patient consultation', 'Initial appointment to discuss your needs.',
       case when (v_item ->> 'virtual')::boolean and (v_item ->> 'inperson')::boolean then 'both'
            when (v_item ->> 'virtual')::boolean then 'virtual' else 'in_person' end::public.care_modality, 45),
      (v_provider, 'Follow-up appointment', 'Follow-up for existing patients.',
       case when (v_item ->> 'virtual')::boolean and (v_item ->> 'inperson')::boolean then 'both'
            when (v_item ->> 'virtual')::boolean then 'virtual' else 'in_person' end::public.care_modality, 30);

    for v_day in 1..5 loop
      insert into public.availability (provider_id, weekday, start_time, end_time, timezone, modality, location_id)
      values (v_provider, v_day, '09:00', '12:00', v_item ->> 'tz', 'both', v_location),
             (v_provider, v_day, '13:00', '17:00', v_item ->> 'tz', 'both', v_location);
    end loop;

    insert into public.provider_verifications (provider_id, status, checks)
    values (v_provider, 'submitted', '{"note":"development sample — not a real submission"}');
  end loop;
end
$$;

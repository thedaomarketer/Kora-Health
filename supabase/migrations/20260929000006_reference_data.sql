-- =============================================================================
-- Kora Health — Reference data required in every environment.
-- (Development-only sample providers live in supabase/seed.sql.)
-- =============================================================================

insert into public.professions (slug, name, sort_order) values
  ('physician', 'Physician', 10),
  ('surgeon', 'Surgeon', 20),
  ('nurse-practitioner', 'Nurse Practitioner', 30),
  ('registered-nurse', 'Registered Nurse', 40),
  ('midwife', 'Midwife', 45),
  ('dentist', 'Dentist', 50),
  ('psychologist', 'Psychologist', 60),
  ('psychotherapist', 'Psychotherapist / Counsellor', 70),
  ('social-worker', 'Clinical Social Worker', 75),
  ('pharmacist', 'Pharmacist', 80),
  ('dietitian', 'Registered Dietitian', 90),
  ('physiotherapist', 'Physiotherapist', 100),
  ('occupational-therapist', 'Occupational Therapist', 110),
  ('optometrist', 'Optometrist', 120),
  ('chiropractor', 'Chiropractor', 130),
  ('wellness-professional', 'Wellness Professional', 200);

insert into public.specialties (slug, name, description, sort_order) values
  ('primary-care', 'Primary care', 'Family medicine and general health care for everyday needs and ongoing care.', 10),
  ('mental-health', 'Mental health', 'Assessment and support for mental and emotional wellbeing.', 20),
  ('psychotherapy', 'Therapy & counselling', 'Talk therapy and counselling for individuals, couples and families.', 25),
  ('womens-health', 'Women''s health', 'Gynecology, reproductive health and menopause care.', 30),
  ('maternal-health', 'Pregnancy & maternal health', 'Prenatal, birth and postpartum care.', 35),
  ('pediatrics', 'Pediatrics', 'Health care for infants, children and adolescents.', 40),
  ('cardiology', 'Heart health', 'Care for the heart and blood vessels, including blood pressure.', 50),
  ('endocrinology', 'Diabetes & hormones', 'Diabetes, thyroid and other hormone-related conditions.', 60),
  ('dermatology', 'Skin, hair & nails', 'Conditions affecting skin, hair and scalp, and nails.', 70),
  ('hematology', 'Blood disorders', 'Blood conditions, including sickle cell disease and anemia.', 80),
  ('nephrology', 'Kidney health', 'Kidney conditions and related care.', 90),
  ('oncology', 'Cancer care', 'Cancer screening, treatment and survivorship support.', 100),
  ('neurology', 'Brain & nerves', 'Conditions affecting the brain, spinal cord and nerves.', 110),
  ('gastroenterology', 'Digestive health', 'Stomach, bowel and liver conditions.', 120),
  ('respiratory', 'Lungs & breathing', 'Asthma and other respiratory conditions.', 130),
  ('rheumatology', 'Joints & autoimmune', 'Arthritis, lupus and other autoimmune conditions.', 140),
  ('orthopedics', 'Bones & muscles', 'Bone, joint and muscle injuries and conditions.', 150),
  ('sexual-health', 'Sexual health', 'Sexual and reproductive health, testing and prevention.', 160),
  ('urology', 'Urology', 'Urinary tract and male reproductive health.', 170),
  ('eye-care', 'Eye care', 'Vision and eye health.', 180),
  ('dental', 'Dental & oral health', 'Teeth, gums and oral health.', 190),
  ('nutrition', 'Nutrition', 'Food, nutrition and dietary guidance.', 200),
  ('rehabilitation', 'Physiotherapy & rehab', 'Movement, recovery and rehabilitation.', 210),
  ('pharmacy', 'Pharmacy & medications', 'Medication reviews and pharmacist consultations.', 220),
  ('geriatrics', 'Healthy aging', 'Care for older adults.', 230),
  ('sleep', 'Sleep health', 'Sleep problems and related conditions.', 240),
  ('allergy-immunology', 'Allergy & immunology', 'Allergies and immune system conditions.', 250),
  ('general-surgery', 'Surgery', 'Surgical consultation and care.', 260);

-- Integration catalog. Every entry starts as 'coming_soon'. An integration is
-- only switched to 'available' once it is implemented, reviewed and tested
-- end-to-end (see docs/INTEGRATIONS.md). Listing here does not imply any
-- partnership or endorsement.
insert into public.integrations (slug, name, category, description, status, scopes, sort_order) values
  ('apple_health', 'Apple Health', 'platform_health',
   'Share selected Apple Health data from your iPhone. Requires the Kora iOS app, which is not yet available.',
   'coming_soon',
   '[{"scope":"activity.read","description":"Steps and activity summaries","data_categories":["measurement"]},
     {"scope":"vitals.read","description":"Heart rate and blood pressure readings","data_categories":["measurement"]}]', 10),
  ('health_connect', 'Health Connect (Android)', 'platform_health',
   'Share selected data from Android Health Connect. Requires the Kora Android app, which is not yet available.',
   'coming_soon',
   '[{"scope":"activity.read","description":"Steps and activity summaries","data_categories":["measurement"]},
     {"scope":"vitals.read","description":"Heart rate and blood pressure readings","data_categories":["measurement"]}]', 20),
  ('wearables', 'Wearable devices', 'wearable',
   'Connect supported fitness trackers and smart watches through their official APIs.',
   'coming_soon',
   '[{"scope":"activity.read","description":"Steps and activity summaries","data_categories":["measurement"]},
     {"scope":"sleep.read","description":"Sleep duration summaries","data_categories":["measurement"]}]', 30),
  ('ehr_fhir', 'Health records (SMART on FHIR)', 'ehr',
   'Import records from participating health systems using the SMART on FHIR standard.',
   'coming_soon',
   '[{"scope":"conditions.read","description":"Conditions","data_categories":["condition"]},
     {"scope":"allergies.read","description":"Allergies","data_categories":["allergy"]},
     {"scope":"medications.read","description":"Medications","data_categories":["medication"]},
     {"scope":"immunizations.read","description":"Immunizations","data_categories":["immunization"]}]', 40),
  ('lab_results', 'Lab results', 'lab',
   'Import laboratory results from participating labs.',
   'coming_soon',
   '[{"scope":"results.read","description":"Lab results","data_categories":["measurement"]}]', 50),
  ('pharmacy', 'Pharmacy & medications', 'pharmacy',
   'Import your medication list from participating pharmacies.',
   'coming_soon',
   '[{"scope":"medications.read","description":"Medication list","data_categories":["medication"]}]', 60),
  ('scheduling', 'External scheduling systems', 'scheduling',
   'Sync provider availability with practice scheduling systems.',
   'coming_soon', '[]', 70);

-- Plans are inactive placeholders. Pricing is a business decision: set real
-- prices and Stripe price ids, then activate (see docs/PAYMENTS.md).
insert into public.subscription_plans (id, name, audience, description, features, is_active, sort_order) values
  ('provider_basic', 'Provider Basic', 'provider', 'Directory profile, appointment requests and secure messaging.',
   '["Public directory profile","Appointment requests","Secure messaging"]', false, 10),
  ('provider_plus', 'Provider Plus', 'provider', 'Everything in Basic plus profile analytics.',
   '["Everything in Basic","Profile analytics","Priority support"]', false, 20),
  ('clinic', 'Clinic', 'clinic', 'Multi-provider clinic management.',
   '["Multiple provider profiles","Clinic page","Shared availability"]', false, 30);

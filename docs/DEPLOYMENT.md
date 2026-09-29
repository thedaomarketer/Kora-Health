# Deployment

Kora runs on **Vercel** (Next.js) with **Supabase** (Auth, Postgres, Storage). Nothing is provisioned yet — follow these steps when creating the production project.

## 1. Supabase project

1. Create a project (for Canadian data residency choose `ca-central-1`).
2. **Auth settings**: Site URL = your production URL; add `https://<domain>/auth/callback` to redirect URLs; enable email confirmation; minimum password length 12; enable leaked-password protection; configure custom SMTP before launch.
3. **Apply migrations** in order from `supabase/migrations` (`supabase db push`, or run each file as the `postgres` user). Do **not** run `supabase/seed.sql` in production.
4. Storage buckets `message-attachments` and `provider-documents` are created by migration 0007 when the storage schema exists. Then set `KORA_STORAGE_ENABLED=true`.

## 2. The `kora_app` database role

The app connects as a role with no privileges of its own that can switch to `anon`/`authenticated`/`service_role` (like PostgREST's `authenticator`):

```sql
create role kora_app login noinherit password '<strong random password>';
grant anon, authenticated, service_role to kora_app;
```

Connect through the **transaction pooler** (port 6543) with user `kora_app.<project-ref>`. Verify after provisioning:

```sql
-- as kora_app: must fail
select * from public.users;
-- as kora_app: must succeed and return only public rows
begin; set local role anon; select count(*) from public.provider_profiles; rollback;
```

> To verify on first provisioning: that the Supabase `postgres` role can grant `service_role` to a custom role, and that the pooler accepts the custom role. If either is refused, connect as `postgres` (which is already a member of these roles) and document the deviation — the RLS model is unchanged because every query still switches role.

TLS: set `DATABASE_SSL=verify` and `DATABASE_CA_CERT` to Supabase's root certificate (Project Settings → Database → SSL). Never disable TLS in production (the app refuses to start with `DATABASE_SSL=disable` in production).

## 3. Vercel

- Import the repository; framework preset Next.js; Node ≥ 20.9.
- Environment variables (see `.env.example`). Production must set `NEXT_PUBLIC_KORA_ENV=production` (hides sample data, enables indexing).
- Optional: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` if running multiple builds side by side.
- Cron: `vercel.json` calls `/api/cron/reminders` once a day (12:00 UTC — the Hobby plan allows only daily crons); Vercel sends `Authorization: Bearer $CRON_SECRET`. Each run reminds for appointments in the next 24 hours, so every appointment is reminded once; on a Pro plan switch to hourly (`0 * * * *`) for more timely reminders.
- Enable Vercel Firewall / bot protection on `/sign-in`, `/sign-up` and `/api/*` for IP-level rate limiting.

## 4. Stripe (optional)

1. Create products/prices; set `stripe_price_id`, `price_cents`, and `is_active = true` on `subscription_plans` rows **only when pricing is decided** (see `docs/PAYMENTS.md`).
2. Add a webhook endpoint `https://<domain>/api/stripe/webhook` for `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`; set `STRIPE_WEBHOOK_SECRET`.
3. Configure the Stripe customer portal.

## 5. Kora AI (optional)

Set `ANTHROPIC_API_KEY` (server-only). Review `docs/AI_SAFETY.md` and run the safety evaluation before enabling for patients.

## 6. First superadmin

After the first staff account signs up, as the database owner:

```sql
insert into public.administrators (user_id, admin_role)
select id, 'superadmin' from public.users where email = '<email>';
```

## Production checklist

- [ ] Migrations applied; seed **not** applied; `select count(*) from provider_profiles where is_demo` = 0
- [ ] `kora_app` role verified (see above); TLS verified
- [ ] `NEXT_PUBLIC_KORA_ENV=production`; all secrets set only in Vercel
- [ ] Auth redirect URLs, SMTP, password policy configured
- [ ] `/api/health` returns 200; cron returns 200 with the secret and 401 without
- [ ] Legal review of Privacy Policy and Terms (currently drafts); privacy impact assessment
- [ ] First superadmin created; verification SOP documented for verifiers
- [ ] Backups/PITR enabled; monitoring/alerting on `/api/health` and error logs

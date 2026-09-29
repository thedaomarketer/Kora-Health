@AGENTS.md

# Kora Health — Engineering Guide

Kora Health is a digital health community platform that helps Black patients and communities discover, connect with and communicate with healthcare professionals. Core flow: **Discover → Connect → Understand → Access care.**

Kora is a technology platform, not a healthcare provider. Never make unsupported claims about health outcomes, disparities, provider quality or clinical effectiveness, and never fabricate data, integrations, credentials, partnerships, testimonials or certifications.

Current status and priorities: see `BUILD_STATUS.md` (keep it updated).

## Tech stack

- **Next.js 16** (App Router, Turbopack, `src/proxy.ts` — *not* `middleware.ts`), React 19, TypeScript (strict), Tailwind CSS v4 (tokens in `src/app/globals.css`).
- **Supabase**: Auth (GoTrue) for identity; **Postgres** for data with RLS; Storage for private files.
- **Data access**: server-side `pg` through `src/lib/db` (see below) — the browser never queries the database.
- **Kora AI**: Anthropic SDK, server-side only (`src/lib/ai`). Default model `claude-opus-5-5`.
- **Payments**: Stripe, server-side only (`src/lib/payments.ts`).
- **Testing**: Vitest (unit + database/RLS), Playwright (E2E, axe accessibility).
- **Hosting**: Vercel (cron in `vercel.json`).

## Architecture

```
Browser ──> Next.js (proxy.ts: CSP nonce, security headers, session refresh)
              ├─ Server Components / Server Actions / Route Handlers
              │     ├─ auth: Supabase Auth (cookies via @supabase/ssr)  → identity only
              │     ├─ data: src/lib/db  → Postgres as anon | authenticated | service_role (RLS)
              │     ├─ AI:   src/lib/ai  → Anthropic API (server-side)
              │     └─ pay:  src/lib/payments → Stripe (server-side)
              └─ /api/* : ai/chat (stream), stripe/webhook, cron/reminders, attachments, health
```

Directory layout:

| Path | Purpose |
|---|---|
| `src/app/(site)` | Public site: home, directory, provider profiles, auth pages, legal |
| `src/app/onboarding` | Patient/provider onboarding + shared profile actions |
| `src/app/patient`, `src/app/provider`, `src/app/admin` | Role-specific app areas (each layout enforces role) |
| `src/app/settings`, `src/app/notifications` | Shared account pages |
| `src/app/api` | Route handlers (each does its own auth; proxy does not cover `/api`) |
| `src/lib` | Server libraries: `db`, `auth`, `env`, `directory`, `care`, `profiles`, `matching`, `ai/*`, `payments`, `storage` |
| `src/components` | UI (`ui/` design system, `layout/`, `care/`, `directory/`, `ai/`, `forms/`) |
| `supabase/migrations` | Schema, RLS, functions (source of truth) |
| `supabase/seed.sql` | **Development-only** fictional sample providers |
| `tests/db` | RLS & workflow tests against real Postgres |
| `tests/e2e` | Playwright E2E + accessibility |
| `scripts/local-stack` | Local Supabase-compatible stack (Auth built from source) |

## Database

Normalized schema in `supabase/migrations` (numbered, applied in order). Core entities: `users`, `administrators`, `patient_profiles`, `provider_profiles`, `provider_credentials`, `provider_verifications`, `professions`, `specialties`, `services`, `locations`, `availability`, `appointment_requests`, `appointments`, `conversations`, `messages`, `message_attachments`, `notifications`, `saved_providers`, `ai_conversations`, `ai_messages`, `consents`, `health_data`, `integrations`, `integration_connections`, `integration_permissions`, `integration_credentials`, `audit_logs`, `reports`, `organizations`, `organization_members`, `clinics`, `subscription_plans`, `subscriptions`, `payments`, `stripe_events`, `rate_limits`.

Rules:
- **RLS on every table.** Each migration revokes all privileges from `anon`/`authenticated` and grants back explicitly, **column-level** where users may edit only some columns (e.g. users can update `display_name` but never `role`/`status`).
- **State transitions go through `SECURITY DEFINER` functions** with `set search_path = ''` (appointments, verification, messaging start, integrations, admin actions). Clients get only `SELECT` on those tables.
- **Function execution is an allowlist** (`...0007_storage_and_privileges.sql`). New functions are *not* executable by clients until granted. Internal helpers (`write_audit`, `notify`, `generate_appointment_reminders`) are never granted to clients.
- Public provider data (`provider_profiles`, `services`, `locations`, `availability`) is separate from private data (`provider_credentials`, `patient_profiles`, `health_data`, messages). `provider_is_public()` defines directory visibility (published + pending/verified + active account).
- `audit_logs` is append-only (trigger blocks update/delete) and has no FKs so it survives account deletion with pseudonymous ids.
- New migration = new file (never edit an applied migration once deployed). Add DB tests in `tests/db/security.test.ts` for every new policy/function.

## Data access (`src/lib/db`)

The app connects as **`kora_app`**, a `NOINHERIT` role with no privileges of its own that is a member of `anon`, `authenticated` and `service_role` (like PostgREST's `authenticator`). Every query runs in a transaction that sets `role` and `request.jwt.claims` — so RLS applies exactly as through Supabase's REST API.

- `asAnon(fn)` — public reads.
- `asUser(user, fn)` — **default** for anything a signed-in user does. `user` must come from `getSessionUser()`/`requireUser()` (validated with Supabase Auth, not just the cookie).
- `asService(fn)` — bypasses RLS. Only for webhooks, cron, AI message persistence, audit writes from trusted server code. Never with user-supplied SQL fragments.
- Always parameterize (`$1`…). Only interpolate code constants/validated integers.
- Postgres errors raised by Kora functions with SQLSTATE `22023`/`P0002` carry user-facing messages; `toUserMessage()` (`src/lib/errors.ts`) shows those and hides everything else.

## Authentication & authorization

- Supabase Auth email/password (min 12 chars). Sign-up stores `role` (patient|provider) in metadata; the `handle_new_auth_user` trigger creates `public.users` and **never** grants admin.
- Session cookies are httpOnly, SameSite=Lax, Secure in production; refreshed in `src/proxy.ts`.
- `requireUser({ role })`, `requireAdmin(role?)` in `src/lib/auth/session.ts` guard pages; server actions use `currentActiveUser()` and return errors instead of redirecting. **The proxy's redirects are UX only** — every page, action and route re-checks, and the database re-checks again.
- Admin roles: `moderator` (reports, users, AI safety), `verifier` (credentials), `superadmin` (all + role management). Granted only via `admin_grant_role` by a superadmin. **Bootstrap the first superadmin** with SQL as the database owner:
  `insert into public.administrators (user_id, admin_role) select id, 'superadmin' from public.users where email = '<email>';`

## Security requirements

- Secrets only in server env vars (never `NEXT_PUBLIC_*`); `src/lib/env.ts` is `server-only` and validates env with zod.
- CSP with per-request nonce (`strict-dynamic`), `frame-ancestors 'none'`, HSTS (prod), nosniff, Referrer-Policy, Permissions-Policy. All routes are dynamic because of the nonce.
- CSRF: Server Actions check Origin automatically; JSON route handlers must call `isSameOrigin()` (`src/lib/http.ts`).
- Validate every input with zod (`src/lib/validation.ts`); DB constraints mirror limits.
- Redirect targets go through `safeNextPath()`.
- Rate limits via `check_rate_limit()` (per user, DB-backed): appointment requests, messages, AI chat, AI matching.
- Uploads: PDF/PNG/JPEG ≤10 MB, verified by magic bytes, private bucket, served by 60-second signed URLs after an RLS check.
- Never render user/AI content as HTML; `SafeMarkdown` renders a small safe subset.
- Log only sanitized error metadata (`sanitizeForLog`); never log message bodies, health data or tokens.
- Do not claim regulatory compliance (PIPEDA/PHIPA/HIPAA, etc.) until formally assessed.

## Healthcare data rules

- Data minimization: collect only what's needed for navigation (no DOB, no government IDs, no insurance numbers).
- Patient profile, health information and AI conversations are visible **only to the patient** — not providers, not admins.
- Providers see a patient's display-name snapshot and what the patient chose to put in requests/messages.
- Health information storage, Kora AI, and personalization each require **separate, revocable consent** (`consents` ledger; `has_consent()`); consent changes are audited.
- Notifications never contain message bodies or health details.
- Account deletion (Settings) deletes the auth user; all personal rows cascade.
- Development seed data is fictional, flagged `is_demo`, labelled in the UI, never verified, and hidden when `NEXT_PUBLIC_KORA_ENV=production`.

## Provider verification

"License verified" is shown **only** when `verification_status = 'verified'`, which only `review_provider_verification()` sets — and only when a verifier confirms all four checklist items (found in public register, name matches, active, jurisdiction matches). Any credential change resets a verified profile to pending. Verification is never described as a quality rating. `VerificationBadge` is the only component that renders status.

## AI safety rules (Kora AI)

See `docs/AI_SAFETY.md`. Non-negotiable:
- Navigation and general education only. Never diagnose, prescribe, change medication/doses, make clinical decisions, claim to be a clinician, or state outcome/disparity statistics.
- `classifyUserMessage()` runs **before** the model: emergency, self-harm crisis, harm-to-others and abuse messages get fixed, human-written responses (`safetyResponse()`) and the model is **not** called.
- `reviewAssistantOutput()` runs after: dosing/diagnosis/clinician-claim patterns get a corrective note and an `output_policy_review` flag.
- Refusals (`stop_reason: "refusal"`) are handled; server-side fallbacks (`fallbacks: "default"`) are enabled.
- Requires `ai_assistant` consent; rate limited; messages persisted server-side with `safety_flags`; admins see aggregate flags only (`admin_ai_safety_summary`), never content.
- Personal context sent to the model: only coarse preferences, and only with `matching_personalization` consent. Stored health data is never sent.
- Matching (`src/lib/matching.ts`) scores only user-selected criteria and explains every reason; it never uses race/ethnicity, and verification status is not a ranking factor.

## Integration rules

See `docs/INTEGRATIONS.md`. Never fabricate an integration. Catalog entries stay `coming_soon` until implemented end-to-end, reviewed and tested; `connect_integration()` refuses anything not `available`. Connections require `health_data_storage` consent and explicit per-scope permissions; users can revoke scopes, disconnect, and delete imported data; all changes are audited. Tokens belong in `integration_credentials` (service-role only, encrypted by the app).

## Coding standards

- TypeScript strict; no `any` in new code. Server-only modules import `"server-only"`.
- `"use server"` files export **only** server actions (every export becomes an endpoint) — helpers go in `src/lib`.
- Functions can't cross the server→client boundary: forms needing per-field errors are client components (`ActionForm` render-prop only in client files).
- Server actions return `ActionResult`; use `failure(err)` for errors; `redirect()` after success when the UI would otherwise lose feedback.
- Next 16: `params`/`searchParams`/`cookies()`/`headers()` are async; use `PageProps<"/route">` / `RouteContext` helpers; read `node_modules/next/dist/docs/` before using unfamiliar APIs.
- Keep SQL in the lib/page that owns it; parameterize everything.

## UI standards

See `docs/DESIGN_SYSTEM.md`. Use tokens (`brand-*`, `clay-*`, `ink`, `muted`, `line`, `canvas`) and components in `src/components/ui`. Mobile-first; minimum 24px targets (WCAG 2.2); visible focus; one `<h1>` per page; `main#main` landmark and skip link; labels for every control (`Field`/`TextField`/…); errors announced (`role="alert"`); `aria-live` for async results; respect reduced motion; no information conveyed by colour alone. Honest empty states and "Coming soon"/"not configured" labels — never simulate success.

## Testing standards

See `docs/TESTING.md`.
- `npm test` — unit (pure logic: safety, matching, validation).
- `npm run test:db` — RLS/workflow tests (needs `TEST_DATABASE_URL`). Every policy or function change needs a test, including a negative (unauthorized) case.
- `npm run test:e2e` — Playwright against the local stack; includes axe (WCAG 2.2 AA) and mobile overflow checks.
- `npm run lint && npm run typecheck && npm run build` must pass.

## Environment variables

Documented in `.env.example`. Key ones: `NEXT_PUBLIC_KORA_ENV`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (kora_app role), `DATABASE_SSL`/`DATABASE_CA_CERT`, `ANTHROPIC_API_KEY`, `KORA_AI_MODEL`, `KORA_AI_EFFORT`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `KORA_STORAGE_ENABLED`. Features without configuration degrade to honest "not configured" states (`features` in `src/lib/env.ts`).

## Deployment

See `docs/DEPLOYMENT.md` (Supabase project setup, `kora_app` role, migrations, Vercel env, Stripe webhook, cron, first superadmin, production checklist).

## Local development

```
npm ci
scripts/local-stack/build-auth.sh          # once: builds Supabase Auth into .local/
scripts/local-stack/setup-db.sh kora_dev    # fresh DB: roles, Auth schema, migrations, seed
node scripts/local-stack/write-env.mjs > .env.local
scripts/local-stack/start.sh kora_dev       # Auth on :9999, gateway on :54321
npm run dev
```
(Or use the Supabase CLI with Docker: `supabase start`, then create the `kora_app` role as in `setup-db.sh`.)

## Definition of Done

A feature is done only when: UI works (desktop + mobile, no horizontal scroll); backend and database work; authorization is enforced in the app **and** the database (with negative tests); inputs validated; errors handled with user-safe messages; loading and empty states exist; tests exist (unit/db/e2e as appropriate) and pass; security reviewed (auth, RLS, injection, CSRF, data exposure, logging); accessibility reviewed (axe clean, keyboard, labels); no console errors; `BUILD_STATUS.md` and relevant docs updated.

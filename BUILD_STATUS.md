# Build status

_Last updated: 2026-09-29_

**Overall: feature-complete MVP, verified locally. Not production-ready** — see Blocked and Known issues. Nothing is deployed and no cloud resources have been created.

## Completed

| Phase | Delivered | Verified by |
|---|---|---|
| 1 Foundation | Next.js 16 + TS + Tailwind v4; normalized Supabase schema (10 migrations, RLS on every table, column-level grants, function allowlist); Supabase Auth; roles (patient/provider + moderator/verifier/superadmin); design system; CSP-nonce proxy & security headers | 48 DB/RLS tests; lint; typecheck; build |
| 2 Patient platform | Onboarding with consents; dashboard; directory search (specialty, profession, city/country, distance via browser location, care type, language, payment, accepting, online requests, verification); profiles; save providers; settings; account deletion | E2E, axe |
| 3 Provider platform | Onboarding; profile & publish rules; services; locations; weekly availability (time-zone aware); credentials & verification submission; patients; analytics | E2E |
| 4 Appointments | Slot-based requests validated against availability; confirm/decline; overlap prevention (exclusion constraint); cancel; reschedule; outcomes; in-app notifications; hourly reminder cron | DB tests, E2E |
| 5 Messaging | Relationship-gated conversations, read status, content-free notifications, reporting, attachments (magic-byte validated, private storage — requires Supabase Storage) | DB tests, E2E |
| 6 Kora AI | Streaming assistant (Claude, server-side), consent gate, rate limits, deterministic emergency/crisis responses, output review, refusal handling + fallbacks, conversation history & deletion | Unit tests; E2E of safety path |
| 7 AI matching | Find care: AI structured interpretation or rule-based fallback; explainable scoring on user-selected criteria only | Unit, E2E |
| 8 Connected data | Consent-gated personal health information; integration catalog, permissions, revoke/disconnect/delete, access history — all integrations honestly "Coming soon" | DB tests, E2E |
| 9 Admin | Overview & system health; verification review with DB-enforced checklist; suspension; reports moderation; users; audit log; AI safety summary; integrations; admin roles | E2E |
| 10 Payments | Stripe Checkout, portal, verified idempotent webhook; plans inactive until priced | Typecheck; not run against Stripe |
| 11–12 Hardening, a11y, perf | Security review (injection, CSRF, redirects, data exposure, logging, TLS); axe WCAG 2.2 AA clean on 34 pages desktop + mobile; no mobile overflow; SEO (metadata, robots, sitemap excluding sample data) | Tests above; npm audit 0 vulnerabilities |
| 13 Deployment prep | `vercel.json` cron, `.env.example`, CI workflow (lint, types, unit, DB, build, audit, full E2E), `docs/DEPLOYMENT.md` | CI not yet run on GitHub |

## In progress

- Nothing actively in progress.

## Blocked (needs owner decision or access)

- **Cloud provisioning**: no Supabase or Vercel project exists for Kora. Creating them has cost/ownership implications — awaiting approval. Until then, attachments (Storage), real email delivery, and production deployment are untested.
- **Kora AI live testing**: no Anthropic API key configured; the model path is typechecked but has not been exercised end-to-end. A red-team safety evaluation is required before enabling.
- **Stripe**: pricing not decided; plans inactive; webhook untested against Stripe.
- **Legal**: Privacy Policy and Terms are drafts pending legal review; no privacy impact assessment yet. No compliance claims are made.
- **Integrations**: each requires native apps or partner agreements (see `docs/INTEGRATIONS.md`).

## Known issues / limitations

- Safety classifier is English-only keyword matching (conservative, false-positive-leaning).
- Directory text search uses ILIKE; add `pg_trgm`/full-text indexes before large scale. Matching loads up to 300 providers into memory.
- Distance search needs provider coordinates; provider-entered locations have no geocoding yet (sample data has city coordinates).
- Notifications are in-app only (no email/SMS/push).
- Availability has no one-off exceptions (holidays); no calendar sync.
- Organizations/clinics tables and policies exist but have no UI yet.
- Provider document upload to `provider-documents` bucket is supported by policy but has no UI.
- Rate limiting of anonymous endpoints relies on Supabase Auth limits and Vercel Firewall (documented, not configured).
- `kora_app` role grants on hosted Supabase must be verified at provisioning (see `docs/DEPLOYMENT.md`).
- No dark mode.

## Security issues

- No open critical/high issues found in review. Residual risks: English-only safety classifier; reliance on correct production role/TLS setup; drafts of legal documents.

## Next priorities

1. Approve and provision Supabase (ca-central-1) + Vercel; run the production checklist.
2. Add Anthropic key in a staging environment; run AI red-team evaluation; clinical advisor review of safety responses.
3. Email notifications (Supabase SMTP/Resend) with content-free templates.
4. Provider document upload UI for verification; verifier SOP.
5. Clinic/organization management UI; availability exceptions.
6. Multilingual UI (French first) and multilingual safety classification.
7. Full-text search indexes and geocoding of provider locations.

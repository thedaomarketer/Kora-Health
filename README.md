# Kora Health

The connected Black health community — a platform that helps people **discover** healthcare professionals, **connect** with them, **understand** their options and **access care**.

- Patients: searchable provider directory, appointment requests, secure messaging, Kora AI navigation assistant, explainable provider matching, private health notes, consent controls.
- Providers: profile, credential verification, availability, request management, messaging, analytics.
- Admins: verification review, moderation, audit log, AI safety monitoring, system health.

Kora is a technology platform, not a healthcare provider, and Kora AI does not diagnose or prescribe.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth, Postgres with row-level security, Storage) · Anthropic Claude (server-side) · Stripe · Vercel.

## Getting started

```bash
npm ci
scripts/local-stack/build-auth.sh           # builds Supabase Auth locally (needs Go)
scripts/local-stack/setup-db.sh kora_dev     # needs local Postgres 16
node scripts/local-stack/write-env.mjs > .env.local
scripts/local-stack/start.sh kora_dev &
npm run dev
```

Development data consists of clearly labelled **fictional sample providers**.

## Quality

```bash
npm run lint && npm run typecheck && npm test
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run test:db
E2E_DB_ADMIN_URL=postgres://postgres:postgres@localhost:5432/kora_dev npm run test:e2e
```

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — architecture, rules and standards
- [`BUILD_STATUS.md`](BUILD_STATUS.md) — what's done, blocked and next
- [`docs/`](docs) — deployment, testing, AI safety, integrations, payments, design system

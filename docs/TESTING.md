# Testing

| Command | What | Needs |
|---|---|---|
| `npm test` | Unit tests (safety classifier, specialty mapping, matching, validation, parsing) | — |
| `npm run test:db` | RLS & workflow tests against real Postgres: each test file creates a fresh DB, applies an auth shim, all migrations and the seed, then runs queries as `anon`/`authenticated` with JWT claims | `TEST_DATABASE_URL` (superuser) |
| `npm run test:e2e` | Playwright: two-sided care flow, authorization boundaries, AI safety & matching, admin verification, axe (WCAG 2.2 AA) on every page, no horizontal overflow | local stack + running app, `E2E_DB_ADMIN_URL` |
| `npm run test:e2e:mobile` | Accessibility/overflow suite at Pixel 7 size | same |

## Local stack (no Docker required)

`scripts/local-stack` builds Supabase Auth (GoTrue) from source via the Go module proxy, creates a database with Supabase's roles, the real Auth schema, Kora's migrations and the dev seed, and serves Auth at `/auth/v1` on port 54321 like a hosted project.

```
scripts/local-stack/build-auth.sh
scripts/local-stack/setup-db.sh kora_dev
node scripts/local-stack/write-env.mjs > .env.local
scripts/local-stack/start.sh kora_dev &
npm run dev
E2E_DB_ADMIN_URL=postgres://postgres:postgres@localhost:5432/kora_dev npm run test:e2e
```

Set `CHROMIUM_PATH` to use a preinstalled browser. Storage and Stripe are not part of the local stack; those features show their "not configured" states.

## Rules

- Every new RLS policy or SECURITY DEFINER function gets a positive **and** negative test in `tests/db`.
- The DB suite was mutation-checked (a deliberately broken policy fails it); keep assertions specific.
- Kora AI calls to the real API are not part of CI. Before enabling or changing the prompt/model, run a manual safety evaluation (see `docs/AI_SAFETY.md`).

#!/usr/bin/env bash
# Creates a local database that mirrors a Supabase project closely enough for
# development and end-to-end tests: Supabase roles, the real Auth schema
# (via GoTrue migrations), Kora migrations, and the development seed.
#
# Usage: scripts/local-stack/setup-db.sh [database_name]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${1:-kora_dev}"
PGHOST="${PGHOST:-localhost}"; PGUSER="${PGUSER:-postgres}"; export PGPASSWORD="${PGPASSWORD:-postgres}"
PSQL=(psql -h "$PGHOST" -U "$PGUSER" -v ON_ERROR_STOP=1 -q)

"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
"${PSQL[@]}" -d "$DB" <<SQL
do \$\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin login createrole password 'postgres';
  end if;
  -- Application connection role: like PostgREST's "authenticator", it has no
  -- privileges of its own and can only act by switching to anon/authenticated/service_role.
  if not exists (select 1 from pg_roles where rolname = 'kora_app') then
    create role kora_app login noinherit password 'kora_app_local';
  end if;
end \$\$;
grant anon, authenticated, service_role to kora_app;
alter role supabase_auth_admin set search_path = auth;
create schema if not exists extensions;
create schema if not exists auth authorization supabase_auth_admin;
grant create on database $DB to supabase_auth_admin;
grant usage on schema public, extensions to anon, authenticated, service_role;
SQL

GOTRUE_DB_DRIVER=postgres \
GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@$PGHOST:5432/$DB?sslmode=disable" \
GOTRUE_DB_MIGRATIONS_PATH="$ROOT/.local/auth-src/migrations" \
GOTRUE_JWT_SECRET=unused-for-migrate-unused-for-migrate \
GOTRUE_SITE_URL=http://localhost:3000 API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  "$ROOT/.local/gotrue" migrate >/dev/null

"${PSQL[@]}" -d "$DB" <<SQL
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
SQL

for f in "$ROOT"/supabase/migrations/*.sql "$ROOT/supabase/seed.sql"; do
  "${PSQL[@]}" -d "$DB" -f "$f" 2>&1 | grep -v NOTICE || true
done
echo "Database $DB ready."

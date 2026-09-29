#!/usr/bin/env bash
# Starts Supabase Auth (GoTrue) on :9999 and a gateway on :54321 that exposes
# it at /auth/v1 like a hosted Supabase project. Ctrl-C stops both.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${1:-kora_dev}"
: "${LOCAL_JWT_SECRET:=local-development-jwt-secret-change-me-0123456789}"
GOTRUE_DB_DRIVER=postgres \
GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:postgres@localhost:5432/$DB?sslmode=disable" \
GOTRUE_JWT_SECRET="$LOCAL_JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated GOTRUE_JWT_ADMIN_ROLES=service_role \
GOTRUE_SITE_URL=http://localhost:3000 GOTRUE_URI_ALLOW_LIST="http://localhost:3000/**" \
API_EXTERNAL_URL=http://localhost:54321/auth/v1 GOTRUE_API_HOST=127.0.0.1 PORT=9999 \
GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true GOTRUE_DISABLE_SIGNUP=false \
GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_LOG_LEVEL=warn \
  "$ROOT/.local/gotrue" serve &
AUTH_PID=$!
node "$ROOT/scripts/local-stack/gateway.mjs" &
GW_PID=$!
trap 'kill $AUTH_PID $GW_PID 2>/dev/null' EXIT INT TERM
wait

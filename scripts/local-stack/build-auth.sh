#!/usr/bin/env bash
# Builds the Supabase Auth server (GoTrue) from source via the Go module proxy.
# Only needed when the Supabase CLI/Docker is unavailable. Output: .local/gotrue
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/.local"
mkdir -p "$OUT"
if [[ -x "$OUT/gotrue" ]]; then echo "gotrue already built at $OUT/gotrue"; exit 0; fi
DIR=$(GOFLAGS=-mod=mod go mod download -json github.com/supabase/auth@master | sed -n 's/.*"Dir": "\(.*\)".*/\1/p')
rm -rf "$OUT/auth-src" && cp -r "$DIR" "$OUT/auth-src" && chmod -R u+w "$OUT/auth-src"
cd "$OUT/auth-src"
# The upstream fork directory is excluded from the module zip; use upstream godotenv.
sed -i '/^replace github.com\/joho\/godotenv/d' go.mod
GOFLAGS=-mod=mod go get github.com/joho/godotenv@v1.5.1
go build -mod=mod -o "$OUT/gotrue" .
echo "Built $OUT/gotrue"

#!/usr/bin/env bash
# Run all ChristNerve SQL migrations (safe to re-run — uses IF NOT EXISTS).
# Usage on server:
#   cd /path/to/ChristNerve
#   chmod +x database/run-migrations.sh
#   ./database/run-migrations.sh
#
# Or with explicit URL:
#   DATABASE_URL='postgresql://user:pass@localhost:5432/christnerve' ./database/run-migrations.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL="${DATABASE_URL:-}"

if [ -z "$DB_URL" ] && [ -f "$ROOT/backend/.env" ]; then
  # shellcheck disable=SC1091
  set -a
  # Prefer DATABASE_URL from backend/.env without sourcing secrets into the shell log
  DB_URL="$(grep -E '^DATABASE_URL=' "$ROOT/backend/.env" | head -1 | cut -d= -f2- | sed 's/^"//;s/"$//')"
  set +a
fi

if [ -z "$DB_URL" ]; then
  echo "DATABASE_URL is required (env or backend/.env)"
  exit 1
fi

run_sql() {
  local file="$1"
  if [ ! -f "$file" ]; then
    echo "skip (missing): $file"
    return 0
  fi
  echo "==> $file"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$file"
}

echo "ChristNerve migrations → $DB_URL"

# Order matters for FKs / dependent features
run_sql "$ROOT/database/migrate-member-auth.sql"
run_sql "$ROOT/database/migrate-member-login.sql"
run_sql "$ROOT/database/migrate-church-brand.sql"
run_sql "$ROOT/database/migrate-pwa.sql"
run_sql "$ROOT/database/migrate-member-staff-depts-visit.sql"
run_sql "$ROOT/database/migrate-visit-join.sql"
run_sql "$ROOT/database/migrate-notifications.sql"
run_sql "$ROOT/database/migrate-audit.sql"
run_sql "$ROOT/database/migrate-market-chat.sql"
run_sql "$ROOT/database/migrate-market-chat-listing.sql"
run_sql "$ROOT/database/migrate-pastoral-care.sql"
run_sql "$ROOT/database/migrate-demo-market-20.sql"

# Optional full demo seed (members + listings). Safe upserts where supported.
if [ "${SEED_DEMO:-0}" = "1" ]; then
  echo "==> seed.sql (SEED_DEMO=1)"
  run_sql "$ROOT/database/seed.sql"
fi

echo "Migrations complete."
echo "Quick check:"
psql "$DB_URL" -c "SELECT slug, name, visit_hero_url IS NOT NULL AS has_hero FROM church_tenants WHERE slug='pka';"
psql "$DB_URL" -c "SELECT COUNT(*) AS market_listings FROM market_listings ml JOIN church_tenants t ON t.id=ml.church_id WHERE t.slug='pka' AND ml.is_active;"

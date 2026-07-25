#!/bin/sh
set -e

# Migracje są idempotentne (drizzle pomija już zastosowane) — bezpieczne przy każdym starcie.
# Seedy NIE lecą tutaj (nie są idempotentne) — odpalamy je raz ręcznie po pierwszym deployu.
echo "→ [entrypoint] Migracje bazy..."
npm run db:migrate

echo "→ [entrypoint] Start serwera Next standalone..."
exec "$@"

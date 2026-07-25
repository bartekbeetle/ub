#!/bin/sh
set -e

# Migracje są idempotentne (drizzle pomija już zastosowane) — bezpieczne przy każdym starcie.
echo "→ [entrypoint] Migracje bazy..."
npm run db:migrate

# seed-core = TYLKO admin + wiersz ustawień, jest idempotentny (przy istniejącym adminie no-op),
# więc może lecieć przy każdym starcie — inaczej świeży deploy nie ma się czym zalogować.
# Celowo NIEfatalny: bez ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD skrypt rzuca błąd, a to nie może
# wywalić kontenera z działającą stroną publiczną.
# Seedy z danymi (db:seed, db:seed-blog, db:seed-weronika) NIE lecą tutaj — ręcznie, raz.
echo "→ [entrypoint] Seed konta admina (idempotentny)..."
npm run db:seed-core || echo "⚠ [entrypoint] seed-core nie przeszedł (sprawdź ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD w env). Startuję serwer mimo to."

echo "→ [entrypoint] Start serwera Next standalone..."
exec "$@"

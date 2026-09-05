#!/bin/sh
set -e

# Migracje są idempotentne (drizzle pomija już zastosowane) — bezpieczne przy każdym starcie.
echo "→ [entrypoint] Migracje bazy..."
npm run db:migrate

# seed-core = TYLKO admin + wiersz ustawień, jest idempotentny (przy istniejącym adminie no-op),
# więc może lecieć przy każdym starcie — inaczej świeży deploy nie ma się czym zalogować.
# Celowo NIEfatalny: bez ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD skrypt rzuca błąd, a to nie może
# wywalić kontenera z działającą stroną publiczną.
# Seedy z danymi (db:seed, db:seed-weronika) NIE lecą tutaj — ręcznie, raz.
# Wyjątek: blog w trybie insert-only, niżej.
echo "→ [entrypoint] Seed konta admina (idempotentny)..."
npm run db:seed-core || echo "⚠ [entrypoint] seed-core nie przeszedł (sprawdź ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD w env). Startuję serwer mimo to."

# Konta logowania trenerek (panel /panel/login). Idempotentny: upsert po mailu, istniejące
# konta pomija — więc gdy trenerka zmieni sobie hasło, kolejny deploy go NIE nadpisze.
# Nowa trenerka dodana w panelu admina dostaje login przy najbliższym starcie kontenera.
# Też NIEfatalny — brak kont trenerek nie może wywalić działającej strony publicznej.
echo "→ [entrypoint] Seed kont trenerek (idempotentny)..."
npm run db:seed-trainer-users || echo "⚠ [entrypoint] seed kont trenerek nie przeszedł. Startuję serwer mimo to."

# Nowe wpisy bloga z content/blog/*.md — TYLKO brakujące slugi (insert-only).
# Bez tego świeżo zdeployowany artykuł leżał w obrazie, ale nie istniał na stronie do czasu
# ręcznego seeda w terminalu Coolify — i potrafił tak wisieć niezauważony.
# Pełny upsert (poprawki treści istniejących wpisów) zostaje ŚWIADOMIE ręczny: `npm run db:seed-blog`,
# bo blog jest edytowalny w panelu admina i nadpisywanie go przy każdym starcie kasowałoby te zmiany.
# NIEfatalny — problem z blogiem nie może wywalić działającej strony.
echo "→ [entrypoint] Publikacja nowych wpisów bloga (insert-only)..."
npm run db:seed-blog-nowe || echo "⚠ [entrypoint] seed nowych wpisów bloga nie przeszedł. Startuję serwer mimo to."

echo "→ [entrypoint] Start serwera Next standalone..."
exec "$@"

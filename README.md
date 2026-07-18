# Uniwersytet Beauty — platforma (Faza A)

Polski marketplace szkoleń beauty z dofinansowaniem BUR. Next.js (App Router, SSR) + TypeScript + Tailwind CSS 4 + Drizzle ORM + PostgreSQL (dev: wbudowany PGlite).

## Uruchomienie lokalne

```bash
cp .env.example .env        # uzupełnij SESSION_SECRET i ADMIN_INITIAL_PASSWORD
npm install
npm run db:setup            # migracje + seed (admin, 4 trenerki, 9 szkoleń, 6 postów)
npm run dev                 # http://localhost:3000
```

Bez `DATABASE_URL` aplikacja używa wbudowanej bazy PGlite (plik `./.pglite`) — zero konfiguracji.
**Uwaga:** PGlite obsługuje jeden proces naraz — nie uruchamiaj seeda równolegle z serwerem dev.

- Strona: `http://localhost:3000`
- Panel admina: `http://localhost:3000/admin` (login z `ADMIN_EMAIL` / `ADMIN_INITIAL_PASSWORD`; przy pierwszym logowaniu system wymusza zmianę hasła)

## Produkcja (Vercel + Supabase)

Decyzja 2026-07-18: hosting = **Vercel** (aplikacja), baza = **Supabase** (Postgres). Railway porzucony
(builder Nixpacks tygodniami wysypywał się na `@tailwindcss/oxide`; artefakty Dockerfile/railway.json
usunięte — w razie potrzeby są w historii gita).

1. **Supabase:** utwórz projekt (region `eu-central-1`). Z Settings → Database weź DWA connection stringi:
   - **pooler / transaction mode (port 6543)** → `DATABASE_URL` aplikacji na Vercelu (serverless!)
   - **direct (port 5432)** → tylko do migracji i seedów odpalanych lokalnie
2. **Migracje + seed (lokalnie, jednorazowo):**
   `DATABASE_URL=<direct-5432> npm run db:migrate && DATABASE_URL=<direct-5432> npm run db:seed-core`
   **`db:seed-core` = tylko admin + ustawienia (idempotentny).** Pełny `db:seed` zawiera FIKCYJNE
   dane demo i na zdalnej bazie odmawia pracy bez `ALLOW_DEMO_SEED=1` — nigdy na produkcji.
   Nowa migracja w przyszłości = ponowny lokalny `db:migrate` przed/po deployu (kolejność wg zgodności schematu).
3. **Vercel:** Import repo `bartekbeetle/ub` z GitHuba (framework: Next.js, zero własnej konfiguracji builda).
   W Project → Settings → Environment Variables ustaw z `.env.example` (koniecznie: `DATABASE_URL` = pooler 6543,
   `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL=https://twojadomena.pl`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`;
   opcjonalnie SMTP_* i piksele).
4. Po pierwszym logowaniu do `/admin` system wymusza zmianę hasła; potem obróć `ADMIN_INITIAL_PASSWORD`.

## Komendy

| Komenda | Opis |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` / `npm run start` | build i serwer produkcyjny |
| `npm run db:generate` | generuje migracje SQL ze schematu (`src/db/schema.ts`) |
| `npm run db:migrate` | wykonuje migracje (PGlite lub Postgres wg env) |
| `npm run db:seed` | dane DEMO do dev (no-op jeśli baza niepusta; na zdalnej bazie wymaga `ALLOW_DEMO_SEED=1`) |
| `npm run db:seed-core` | seed produkcyjny: admin + ustawienia, zero danych demo (idempotentny) |

## Architektura (skrót)

- `src/db/schema.ts` — pełny schemat (leady, przydziały, rozliczenia, audit log, użytkownicy z rolą `admin`/`trenerka` — rola trenerki gotowa pod panel self-service w Fazie B)
- `src/lib/matching.ts` — automatyczna dystrybucja leadów (kategoria + województwo, multi-sell max wg ustawień, różne miasta, limit miesięczny trenerki)
- `src/lib/email.ts` — wysyłka SMTP albo kolejka w DB gdy brak konfiguracji
- `src/app/(public)` — strony B2C (SSR), `src/app/admin` — panel, `src/app/api` — API
- Bezpieczeństwo: sesje httpOnly w DB, bcrypt, rate limiting, honeypot, maskowanie danych, anonimizacja RODO, audit log, nagłówki CSP/HSTS

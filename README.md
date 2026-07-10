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

## Produkcja (Railway)

1. Utwórz serwis **PostgreSQL** na Railway i skopiuj `DATABASE_URL`.
2. W serwisie aplikacji ustaw zmienne z `.env.example` (koniecznie: `DATABASE_URL`, `SESSION_SECRET`, `NEXT_PUBLIC_SITE_URL=https://twojadomena.pl`, `ADMIN_EMAIL`, `ADMIN_INITIAL_PASSWORD`; opcjonalnie SMTP_* i piksele).
3. Build command: `npm run build` · Start command: `npm run db:setup && npm run start`
   (migracje są idempotentne; seed pomija się, gdy baza ma dane).
4. Po pierwszym logowaniu do `/admin` zmień hasło i obróć `ADMIN_INITIAL_PASSWORD`.

## Komendy

| Komenda | Opis |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` / `npm run start` | build i serwer produkcyjny |
| `npm run db:generate` | generuje migracje SQL ze schematu (`src/db/schema.ts`) |
| `npm run db:migrate` | wykonuje migracje (PGlite lub Postgres wg env) |
| `npm run db:seed` | dane startowe (no-op jeśli baza niepusta) |

## Architektura (skrót)

- `src/db/schema.ts` — pełny schemat (leady, przydziały, rozliczenia, audit log, użytkownicy z rolą `admin`/`trenerka` — rola trenerki gotowa pod panel self-service w Fazie B)
- `src/lib/matching.ts` — automatyczna dystrybucja leadów (kategoria + województwo, multi-sell max wg ustawień, różne miasta, limit miesięczny trenerki)
- `src/lib/email.ts` — wysyłka SMTP albo kolejka w DB gdy brak konfiguracji
- `src/app/(public)` — strony B2C (SSR), `src/app/admin` — panel, `src/app/api` — API
- Bezpieczeństwo: sesje httpOnly w DB, bcrypt, rate limiting, honeypot, maskowanie danych, anonimizacja RODO, audit log, nagłówki CSP/HSTS

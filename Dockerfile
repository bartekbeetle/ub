# UB — Next.js SSR + Postgres.
# Własny obraz omija buga Nixpacks/@tailwindcss/oxide: czysta instalacja na
# Linuksie (glibc) pobiera właściwą binarkę oxide-linux-x64-gnu.
FROM node:22-bookworm-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Manifesty najpierw — cache warstwy zależności.
COPY package.json package-lock.json* ./

# Pełna instalacja (z devDeps: tailwind, typescript, tsx, drizzle-kit) —
# NIE ustawiamy jeszcze NODE_ENV=production, bo build i migracje ich potrzebują.
RUN npm install --no-audit --no-fund

# Kod aplikacji (bez node_modules/.next/.pglite — patrz .dockerignore).
COPY . .

# Produkcyjny build Next.js (output: standalone -> .next/standalone/server.js).
RUN npm run build

# Standalone server oczekuje static i public względem swojego katalogu.
RUN cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public

# Runtime = produkcja. Pełny node_modules zostaje (tsx/pg do migracji).
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Migracja + seed-core (admin/ustawienia, idempotentny, ZERO danych demo) + standalone server.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed-core && node .next/standalone/server.js"]

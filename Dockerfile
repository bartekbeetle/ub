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

# Produkcyjny build Next.js.
RUN npm run build

# Runtime = produkcja. tsx nadal w node_modules, więc migracja/seed działają.
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
EXPOSE 3000

# Migracja + seed + start (jak dotychczasowy startCommand).
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]

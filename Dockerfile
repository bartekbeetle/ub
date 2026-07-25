# syntax=docker/dockerfile:1
# Uniwersytet Beauty — produkcyjny obraz pod Coolify (Next.js 15 standalone).
# Build NIE potrzebuje bazy: wszystkie publiczne strony czytające DB są force-dynamic.

FROM node:20-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---- build ----
FROM base AS builder
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# next.config: output "standalone" -> .next/standalone/server.js.
# Standalone nie kopiuje static/public sam — dokładamy je OBOK server.js,
# żeby serwer je znalazł w runtime.
RUN npm run build \
 && cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Cały /app (z pełnym node_modules) — dzięki temu entrypoint ma tsx+drizzle do migracji,
# a standalone server ma swoje wbudowane node_modules do serwowania. Oba współistnieją.
COPY --from=builder /app ./
EXPOSE 3000
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", ".next/standalone/server.js"]

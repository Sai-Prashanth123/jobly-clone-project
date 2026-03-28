# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies (including devDeps needed for tsc)
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

# Generate Prisma client → src/generated/prisma/
RUN npx prisma generate

# Compile TypeScript → dist/
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Copy Prisma generated files into dist/
# (tsc does not copy .js/.wasm non-source files from src/)
RUN cp -r src/generated dist/

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Security: run as non-root
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled app (includes dist/generated/prisma with WASM client)
COPY --from=builder /app/dist ./dist

USER appuser

# ── Hardcoded environment ─────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=3001
ENV FRONTEND_URL=https://yellow-sea-0a9088500.6.azurestaticapps.net
ENV SUPABASE_URL=https://knwrmyprxclakidqlaqt.supabase.co
ENV SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtud3JteXByeGNsYWtpZHFsYXF0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQwNjI2OSwiZXhwIjoyMDg5OTgyMjY5fQ.fwwl52fJDQXdZoGkPiryhnGdDu2gdBGRm2fyDc1hTaA
ENV SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtud3JteXByeGNsYWtpZHFsYXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDYyNjksImV4cCI6MjA4OTk4MjI2OX0.YOeCxtmYgMV-VOSJ7PhIkj8GglIRm2V6swTfhqsyafA
ENV DATABASE_URL=postgresql://postgres:FoBzMXdZOegCid8H@db.knwrmyprxclakidqlaqt.supabase.co:5432/postgres
ENV DIRECT_URL=postgresql://postgres:FoBzMXdZOegCid8H@db.knwrmyprxclakidqlaqt.supabase.co:5432/postgres
ENV RESEND_API_KEY=re_7uw1BMiH_DHCZeibxG2VjoVGobpUw2x72

EXPOSE 3001

CMD ["node", "dist/server.js"]

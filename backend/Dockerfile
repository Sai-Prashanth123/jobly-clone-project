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

# Strip sourcemaps from the production output — they expose original
# TypeScript to anyone who can pull the image, and aren't useful at runtime.
RUN find dist -name '*.map' -delete

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
ENV SUPABASE_URL=https://ufkrfrmqangydrjbzljo.supabase.co
ENV SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVma3Jmcm1xYW5neWRyamJ6bGpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTEzNDA1NSwiZXhwIjoyMDk0NzEwMDU1fQ.vas0fMca0dBOjDpuFW83XaT4KmmTGDAqd9Ewft_SzmA
ENV SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVma3Jmcm1xYW5neWRyamJ6bGpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMzQwNTUsImV4cCI6MjA5NDcxMDA1NX0.TMmpWm6Nru8KgJMJy4eQbYUo4cQ6XebBuQvsEv4mhK0
# Password "Jobly@123$!" url-encoded: @→%40, $→%24, !→%21
ENV DATABASE_URL=postgresql://postgres:Jobly%40123%24%21@db.ufkrfrmqangydrjbzljo.supabase.co:5432/postgres
ENV DIRECT_URL=postgresql://postgres:Jobly%40123%24%21@db.ufkrfrmqangydrjbzljo.supabase.co:5432/postgres
ENV GMAIL_USER=saip00519@gmail.com
ENV GMAIL_APP_PASSWORD="gsox vqdx akvi irrh"

EXPOSE 3001

CMD ["node", "dist/server.js"]

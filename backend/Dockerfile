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

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/server.js"]

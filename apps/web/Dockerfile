# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy workspace root config files
COPY package.json turbo.json tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types

# Copy web package files
COPY apps/web/package.json ./apps/web/package.json

# Install all dependencies (workspace-aware)
RUN npm install --workspace=@inkflow/web --workspace=@inkflow/shared-types

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared-types ./packages/shared-types

COPY apps/web ./apps/web
COPY package.json turbo.json tsconfig.base.json ./

# Build shared-types first
RUN npm run build --workspace=@inkflow/shared-types 2>/dev/null || true

# Build Next.js app
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN node_modules/.bin/next build

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ─── Dependencies ─────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci --workspace=apps/worker --workspace=packages/shared-types

# ─── Build ────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=apps/worker

# ─── Production image ─────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 worker

COPY --from=builder --chown=worker:nodejs /app/apps/worker/dist ./dist
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker/package.json ./

USER worker
CMD ["node", "dist/index.js"]

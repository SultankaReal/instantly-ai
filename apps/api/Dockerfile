FROM node:20-alpine AS base
WORKDIR /app

# ── deps: install workspace deps ──────────────────────────────────────────────
FROM base AS deps
COPY package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/api/package.json ./apps/api/
RUN npm install --workspace=@inkflow/shared-types --workspace=@inkflow/api --ignore-scripts

# ── builder: compile TypeScript ────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
COPY tsconfig.base.json ./
RUN npm run build --workspace=@inkflow/shared-types
RUN cd apps/api && npx prisma generate
RUN npm run build --workspace=@inkflow/api

# ── runner: minimal production image ──────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "dist/index.js"]

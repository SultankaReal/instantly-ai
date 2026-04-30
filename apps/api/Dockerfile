FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspace=packages/shared-types --workspace=apps/api

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/shared-types
RUN npm run build --workspace=apps/api
RUN cd apps/api && npx prisma generate

FROM base AS runner
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./node_modules/.prisma
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]

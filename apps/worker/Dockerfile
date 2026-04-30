FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY apps/worker/package.json ./apps/worker/
RUN npm install --workspace=@inkflow/shared-types --workspace=@inkflow/worker --ignore-scripts

COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/worker ./apps/worker
COPY tsconfig.base.json ./

RUN npm run build --workspace=@inkflow/shared-types 2>/dev/null || true
RUN npm run build --workspace=@inkflow/worker

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/package.json ./package.json
CMD ["node", "dist/index.js"]

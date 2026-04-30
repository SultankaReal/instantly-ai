# ─── Build Stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace files for monorepo resolution
COPY package.json turbo.json tsconfig.base.json ./
COPY apps/bot/package.json ./apps/bot/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install all dependencies (including devDeps for build)
RUN npm install --workspace=apps/bot --workspace=packages/shared-types --include-workspace-root

# Copy source files
COPY apps/bot/tsconfig.json ./apps/bot/
COPY apps/bot/src ./apps/bot/src
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/shared-types/tsconfig.json ./packages/shared-types/

# Build shared-types first, then bot
RUN npm run build --workspace=packages/shared-types && \
    npm run build --workspace=apps/bot

# ─── Run Stage ───────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only production dependencies manifest
COPY apps/bot/package.json ./package.json

# Install only production dependencies
RUN npm install --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/apps/bot/dist ./dist

# Non-root user for security
RUN addgroup -S inkflow && adduser -S inkflow -G inkflow
USER inkflow

CMD ["node", "dist/index.js"]

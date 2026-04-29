# /start — Bootstrap Поток Project

Bootstrap the complete monorepo from SPARC documentation.

## Phase 1: Monorepo Skeleton

Create directory structure and root config files:

```bash
# Root package.json with workspaces
# turbo.json for build pipeline
# tsconfig.base.json (strict: true)
# .gitignore
# .env.example (from secrets-management.md)
```

Create packages:
- `packages/shared-types/` — TypeScript types + Zod schemas
- `apps/api/` — Fastify v5 skeleton (package.json, tsconfig, src/index.ts)
- `apps/web/` — Next.js 15 App Router (npx create-next-app with TypeScript)
- `apps/worker/` — BullMQ worker skeleton (package.json, tsconfig, src/index.ts)

## Phase 2: Dependencies (4 parallel tasks)

Run in parallel:

**Task 1 — api:**
```bash
cd apps/api && npm install fastify @fastify/jwt @fastify/cors @fastify/rate-limit \
  @fastify/multipart prisma @prisma/client bcryptjs jsonwebtoken \
  nodemailer imapflow bullmq ioredis zod dotenv
```

**Task 2 — web:**
```bash
cd apps/web && npm install next react react-dom @tanstack/react-query \
  zustand tailwindcss @radix-ui/react-* zod react-hook-form
```

**Task 3 — worker:**
```bash
cd apps/worker && npm install bullmq ioredis nodemailer imapflow \
  @anthropic-ai/sdk ioredis prisma @prisma/client bcryptjs dotenv
```

**Task 4 — shared-types:**
```bash
cd packages/shared-types && npm install zod typescript
```

## Phase 3: Database Setup

```bash
# Initialize Prisma schema from docs/Architecture.md DDL
cd apps/api
npx prisma init --datasource-provider postgresql

# Write prisma/schema.prisma from docs/Architecture.md §6
# Tables: users, email_accounts, campaigns, contacts, email_sends,
#         warmup_events, inbox_score_snapshots, inbox_alerts,
#         inbox_messages, subscriptions, payment_events, unsubscribes

# Generate and apply migration
npx prisma migrate dev --name initial_schema
npx prisma generate
```

## Phase 4: Docker Compose

Write `docker-compose.yml` from `docs/Architecture.md §5`:
- nginx (reverse proxy, :80/:443)
- certbot (TLS renewal)
- api (Fastify, :3000)
- web (Next.js, :3001)
- worker (BullMQ)
- postgres (PostgreSQL 16, :5432)
- redis (Redis 7, :6379)
- minio (MinIO, :9000/:9001)
- prometheus (:9090)
- grafana (:3002)

Write `Dockerfile` for api, web, worker (multi-stage builds).

## Phase 5: Health Check

Start services and verify:
```bash
docker compose up -d postgres redis
sleep 5
curl http://localhost:3000/health  # → { status: "ok", db: "ok", redis: "ok" }
```

## Completion

```
git add .
git commit -m "chore: initial project scaffold from SPARC documentation"
git tag v0.1.0-scaffold
git push origin main --tags
```

Print summary:
- Directory tree
- Services started
- Health check URL
- Next: `/run mvp` or `/go [feature]`

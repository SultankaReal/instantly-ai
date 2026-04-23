---
description: Bootstrap entire Inkflow project from documentation. Generates monorepo skeleton,
  all packages (api, web, worker, shared-types, email-templates), Docker configs, Prisma schema,
  core modules with algorithms, and basic tests. $ARGUMENTS: optional flags --skip-tests, --skip-seed, --dry-run.
---

# /start $ARGUMENTS

## Purpose

One-command project generation from documentation → working monorepo with `docker compose up`.

## Prerequisites

- Documentation in `docs/` directory (SPARC output — all 9 docs present)
- CC toolkit in project root (CLAUDE.md, .claude/, .mcp.json)
- Node.js 20+ and npm 10+ installed
- Docker + Docker Compose installed
- Git initialized

## Process

### Phase 1: Foundation (sequential — everything depends on this)

1. **Read all project docs** to build full context:
   - `docs/Architecture.md` → monorepo structure, Docker Compose, tech stack, SQL DDL
   - `docs/Specification.md` → data model (6 entities), API endpoints, NFRs
   - `docs/Pseudocode.md` → core algorithms (sendPost, subscribe, checkPostAccess, etc.)
   - `docs/Completion.md` → env config, deployment setup, env vars reference
   - `docs/PRD.md` → features F1-F9, timeline, success metrics
   - `docs/Refinement.md` → edge cases, testing strategy, ADRs

2. **Generate root configs:**
   - `package.json` — workspaces: `["apps/*", "packages/*"]`, scripts: dev, build, test, lint
   - `docker-compose.yml` — from Architecture.md (api, web, worker, postgres, redis, minio, nginx, prometheus, grafana)
   - `.env.example` — from Completion.md env vars (JWT_SECRET, STRIPE_*, POSTMARK_*, ANTHROPIC_*, etc.)
   - `.gitignore` — node_modules, .env, dist, .next, coverage, *.log
   - `tsconfig.base.json` — base TypeScript config (strict: true, target: ES2022)
   - `turbo.json` — Turborepo pipeline config (build → test → lint)

3. **Git commit:** `chore: project root configuration`

### Phase 2: Packages (parallel via Task tool ⚡)

Launch 5 parallel Tasks:

#### Task A: packages/shared-types ⚡

Read and use as source:
- `docs/Specification.md` → data model → TypeScript interfaces
- `docs/Pseudocode.md` → function signatures → shared types

Generate:
- `packages/shared-types/src/models/` — User, Publication, Post, Subscriber, EmailSend, EmailEvent interfaces
- `packages/shared-types/src/api/` — Request/Response types for all 17 API endpoints
- `packages/shared-types/src/queue/` — BullMQ job data types (EmailBatch, ImportJob)
- `packages/shared-types/src/schemas/` — Zod schemas for all entities
- `packages/shared-types/package.json`, `tsconfig.json`, `index.ts`
- Unit tests for Zod schema validation

**Commits:** `chore(shared-types): TypeScript types and Zod schemas`

#### Task B: packages/email-templates ⚡

Read and use as source:
- `docs/Specification.md` → US-04 (confirmation email), US-06 (dunning email)
- `docs/Pseudocode.md` → subscribe(), handleStripeWebhook() for email templates needed

Generate:
- `packages/email-templates/src/` — React Email templates:
  - `confirmation.tsx` — subscription confirmation email
  - `post-notification.tsx` — new post email (with open/click tracking pixels)
  - `dunning.tsx` — failed payment notification
  - `unsubscribe-confirmation.tsx`
- `packages/email-templates/package.json`, `tsconfig.json`, `index.ts`

**Commits:** `feat(email-templates): React Email templates for all transactional emails`

#### Task C: apps/api ⚡

Read and use as source:
- `docs/Specification.md` → 17 API endpoints → route files
- `docs/Architecture.md` → Fastify setup, middleware, Docker config
- `docs/Pseudocode.md` → algorithms → service implementations
- `docs/Completion.md` → env config

Generate:
- `apps/api/src/app.ts` — Fastify instance, plugins registration
- `apps/api/src/plugins/` — auth.ts (JWT), db.ts (Prisma), redis.ts, rate-limit.ts, cors.ts
- `apps/api/src/routes/` — auth.ts, publications.ts, posts.ts, subscribers.ts, payments.ts, webhooks.ts, ai.ts, health.ts
- `apps/api/src/services/` — implementations from Pseudocode.md:
  - `send-post.service.ts` — sendPost() + enqueue batches
  - `subscriber.service.ts` — subscribe() + confirmSubscription() + unsubscribe()
  - `post-access.service.ts` — checkPostAccess() + getPostContent()
  - `stripe-webhook.service.ts` — handleStripeWebhook()
  - `postmark-webhook.service.ts` — handlePostmarkWebhook() + aggregatePostAnalytics()
  - `seo.service.ts` — generateSEOMetadata()
  - `draft.service.ts` — generateDraft() via Claude API
- `apps/api/prisma/schema.prisma` — from Specification.md data model (6 entities + all ENUMs)
- `apps/api/prisma/migrations/` — initial migration
- `apps/api/package.json`, `tsconfig.json`, `Dockerfile`
- Integration tests for key routes (subscribe, webhook handlers)

**Commits:**
- `chore(api): Fastify app setup and plugins`
- `feat(api): all 17 API routes from Specification.md`
- `feat(api): service implementations from Pseudocode.md`
- `chore(db): Prisma schema from data model`

#### Task D: apps/web ⚡

Read and use as source:
- `docs/Specification.md` → US-01 through US-09 → page layouts
- `docs/Architecture.md` → Next.js App Router structure, ISR config
- `docs/PRD.md` → features, user personas → UI requirements

Generate:
- `apps/web/src/app/` — App Router pages:
  - `layout.tsx`, `page.tsx` — root layout and homepage
  - `[slug]/` — public publication page (SSR)
  - `[slug]/posts/[postSlug]/` — post page with SEO metadata + paywall
  - `[slug]/subscribe/` — subscription page
  - `dashboard/` — author dashboard (protected)
  - `dashboard/posts/` — post list and editor
  - `dashboard/analytics/` — analytics views
  - `dashboard/subscribers/` — subscriber management
  - `dashboard/settings/` — publication settings
- `apps/web/src/components/` — editor, paywall, subscribe-form, analytics-chart
- `apps/web/src/lib/` — api-client.ts, auth.ts
- `apps/web/src/hooks/` — useAuth, usePost, useAnalytics
- `apps/web/package.json`, `tsconfig.json`, `next.config.ts`, `Dockerfile`

**Commits:**
- `chore(web): Next.js 15 App Router setup`
- `feat(web): public pages with SEO metadata (US-02)`
- `feat(web): author dashboard pages`

#### Task E: apps/worker ⚡

Read and use as source:
- `docs/Pseudocode.md` → sendBatchWorker() + parseSubstackExport()
- `docs/Architecture.md` → BullMQ setup, Worker Dockerfile
- `docs/Completion.md` → Redis auth URL, worker env vars

Generate:
- `apps/worker/src/index.ts` — worker entry point, queue connections
- `apps/worker/src/workers/` — email-send.worker.ts (sendBatchWorker), import.worker.ts (parseSubstackExport)
- `apps/worker/src/queues/` — queue definitions with retry config (5× exponential backoff)
- `apps/worker/package.json`, `tsconfig.json`, `Dockerfile`
- Unit tests for worker handlers

**Commits:**
- `chore(worker): BullMQ worker setup`
- `feat(worker): email send batch worker from Pseudocode.md`
- `feat(worker): Substack import worker from Pseudocode.md`

### Phase 3: Integration (sequential)

1. **Verify cross-package imports** (shared-types used correctly in api, web, worker)
2. **Docker build:** `docker compose build`
3. **Start services:** `docker compose up -d`
4. **Database setup:**
   - `cd apps/api && npx prisma migrate dev --name init`
   - `cd apps/api && npx prisma db seed` (seed with test author + publication)
5. **Health check:** `curl -s http://localhost:3000/api/health | jq .`
6. **Run tests:**
   - `npm run test` — unit tests across all packages
   - `npm run test:integration` — integration tests against real DB
7. **Git commit:** `chore: verify docker integration`

### Phase 4: Finalize

1. Generate/update `README.md` with quick start instructions
2. Final git tag: `git tag v0.1.0-scaffold`
3. Report summary: files generated, services running, what needs manual attention

## Output

After /start completes:
```
inkflow/
├── apps/
│   ├── api/          — Fastify API (port 3000)
│   ├── web/          — Next.js frontend (port 3001)
│   └── worker/       — BullMQ worker
├── packages/
│   ├── shared-types/ — TypeScript types, Zod schemas
│   └── email-templates/ — React Email templates
├── docker-compose.yml
├── .env.example
└── turbo.json
```

Services running: api :3000, web :3001, postgres :5432, redis :6379, minio :9000

## Flags

- `--skip-tests` — skip test file generation (faster, not recommended)
- `--skip-seed` — skip database seeding
- `--dry-run` — show plan without executing

## Estimated Time

- With 5 parallel tasks: ~20-30 minutes
- Files generated: ~120-150
- Commits: ~15-20

## Error Recovery

If a task fails mid-generation:
- All completed phases are committed to git
- Re-run `/start` — it detects existing files and skips completed phases
- Or fix the issue manually and continue

## Swarm Agents Used

| Phase | Agents | Parallelism |
|-------|--------|-------------|
| Phase 1 | Main | Sequential |
| Phase 2 | 5 Task tools (A-E) | ⚡ Parallel |
| Phase 3 | Main | Sequential |
| Phase 4 | Main | Sequential |

# Project: Inkflow

## Overview

Inkflow — SaaS newsletter platform with 0% platform commission, native SEO, and AI writing assistant.
Flat SaaS pricing ($0/$29/$79/$149/mo) vs Substack's 10% revenue share. Blue Ocean position: no competitor combines `0% commission + native SEO + AI tools`. TAM $1.76B, CAGR 18.2%.

**MVP:** Publishing, Subscriber Management, Paid Subscriptions (Stripe), SEO-native posts, Analytics, Substack Import.
**v1.0:** AI Writing Assistant (Claude API), Cross-publication Recommendations, Multi-stream Monetization.

## Problem & Solution

**Problem:** Substack's 10% commission creates a "success tax" — the more successful an author, the more they pay. At $10K/mo revenue, that's $1,000/mo to the platform.

**Solution (TRIZ #35 — Parameter Change):** Shift from % revenue to flat SaaS fee. Author keeps 100% revenue minus Stripe fees (2.9% + $0.30). Platform earns fixed monthly SaaS revenue instead.

**Critical risk:** Stripe unavailable for RU legal entity (90% probability) — requires non-RU entity (Cyprus/UAE) before payment processing goes live.

## Architecture

```
Distributed Monolith (Monorepo) — Docker Compose on VPS (AdminVPS/HOSTKEY)

apps/
  api/        — Fastify + TypeScript, REST API, JWT auth
  web/        — Next.js 15 App Router SSR, public + dashboard
  worker/     — BullMQ email queue, Postmark delivery
packages/
  shared-types/     — TypeScript types, Zod schemas
  email-templates/  — React Email templates

Infrastructure: Nginx → [api :3000, web :3001] | PostgreSQL 16 | Redis 7 | MinIO | Prometheus + Grafana
```

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| API | Fastify + TypeScript | 2× faster than Express; type safety |
| Frontend | Next.js 15 (App Router) | SSR = SEO advantage (LCP < 1.5s) |
| Database | PostgreSQL 16 + Prisma | ACID + JSONB; Prisma for type-safe queries |
| Queue | BullMQ + Redis 7 | Persistent retries; bull-board dashboard |
| Email | Postmark + Resend fallback | Highest deliverability for transactional email |
| Payments | Stripe (global) + CloudPayments (RU) | RU entity constraint |
| AI | Claude API via MCP (claude-sonnet-4-6) | Per architecture constraint |
| Storage | MinIO (S3-compatible) | Self-hosted on VPS |
| CDN/DNS | Cloudflare | Free; DDoS; DNS management |
| Monitoring | Prometheus + Grafana | Custom dashboards + alert rules |

## Key Algorithms

```typescript
sendPost(postId: UUID, authorId: UUID): Promise<void>
  // Verifies ownership, enqueues BullMQ jobs in batches of 1000, updates post.status='sent'

sendBatchWorker(job: Job<EmailBatch>): Promise<void>
  // Processes Postmark batch API, handles bounces → subscriber status updates

generateSEOMetadata(post: Post, publication: Publication): SEOMetadata
  // title ≤60 chars, description ≤160 chars, OG/Twitter/Article schema, canonical URL

subscribe(publicationId: UUID, email: string): Promise<void>
  // Double opt-in: upsert with conflict handling, sends confirmation email, 48h token expiry

checkPostAccess(postId: UUID, userId: UUID | null): Promise<PostContent>
  // JWT verify → DB subscriber tier check → server-side 20% truncation for free tier

handleStripeWebhook(rawBody: Buffer, sig: string): Promise<void>
  // constructEvent() with HMAC, processes checkout.completed/payment_failed/subscription_deleted
```

## Security Rules

⚠️ **Critical — always enforce:**
- JWT HS256: access token 15min, refresh 7 days, Redis blacklist for logout
- Passwords: bcrypt cost factor 12 minimum
- Rate limiting: 100/min anonymous, 1000/min authenticated, 10/hr AI generation
- Input validation: Zod schemas at ALL API boundaries (never trust request body)
- HTML content: DOMPurify on ALL user-generated HTML before storage and render
- Stripe webhook: always use `constructEvent(rawBody, sig, secret)` — never rawBody alone
- Postmark webhook: verify X-Postmark-Signature shared-secret header
- SQL: Prisma ORM only — never string concatenation in queries
- Secrets: env vars only (`${VAR}` in docker-compose) — never hardcode
- GDPR gap: no consent_log yet — do NOT acquire EU users until implemented

## Parallel Execution Strategy

- Use `Task` tool for independent subtasks
- Run tests, linting, type-checking in parallel
- For complex features: spawn specialized agents
- Phase 2 of /start: 5 parallel Tasks (api, web, worker, shared-types, email-templates)

## Swarm Agents

| Scenario | Agents | Parallelism |
|----------|--------|-------------|
| Large feature | planner + 2-3 implementation agents | Yes |
| Refactoring | code-reviewer + refactor agents | Yes |
| Bug fix | 1 agent | No |
| Security review | architect + code-reviewer | Yes |

## Git Workflow

- Commit after each logical change (not at end of session)
- Format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Push after each phase when using /go or /feature

## Available Agents

| Agent | Trigger |
|-------|---------|
| `@planner` | Break down features from Pseudocode.md into tasks |
| `@code-reviewer` | Review code quality, edge cases from Refinement.md |
| `@architect` | Verify architecture consistency (Architecture.md + Solution_Strategy.md) |

## Available Skills

**Lifecycle skills** (`.claude/skills/`):
- `sparc-prd-mini` — full SPARC documentation generator (orchestrator)
- `explore` — Socratic questioning → Product Brief
- `goap-research-ed25519` — GOAP A* + OODA → Research Findings
- `problem-solver-enhanced` — 9 modules + TRIZ → Solution Strategy
- `requirements-validator` — swarm validation (INVEST/SMART, 5 agents)
- `brutal-honesty-review` — rigorous post-implementation review

**Project skills** (`.claude/skills/`):
- `project-context` — domain knowledge (newsletter platforms, Postmark, Stripe, BullMQ)
- `coding-standards` — Fastify/Next.js/Prisma patterns
- `testing-patterns` — Vitest + Playwright + Testcontainers patterns
- `security-patterns` — JWT/webhook/API security patterns
- `feature-navigator` — roadmap-aware feature navigation

## Quick Commands

| Command | Purpose |
|---------|---------|
| `/start` | Bootstrap full project (monorepo skeleton → Docker → DB → health check) |
| `/run mvp` | Autonomous loop: bootstrap + implement all MVP features |
| `/run all` | Autonomous loop: implement ALL features |
| `/go [feature]` | Auto-select pipeline and implement one feature |
| `/feature [name]` | Full 4-phase SPARC lifecycle for a feature |
| `/plan [name]` | Lightweight implementation plan for simple tasks |
| `/next` | Show feature roadmap status and next priority |
| `/test [scope]` | Run/generate tests |
| `/deploy [env]` | Deploy to staging/production |
| `/docs` | Generate bilingual documentation (RU/EN) |
| `/myinsights [title]` | Capture development insight to knowledge base |
| `/harvest` | Extract project knowledge for reuse |

## 🔍 Development Insights (живая база знаний)

Index: [myinsights/1nsights.md](myinsights/1nsights.md) — check here FIRST before debugging.
⚠️ On error → grep the error string in the index → read only the matched detail file.
Capture new findings: `/myinsights [title]`

## 🔄 Feature Development Lifecycle

New features use the 4-phase lifecycle: `/feature [name]`
1. **PLAN** — sparc-prd-mini (with Gate + external skills) → `docs/features/<n>/sparc/`
2. **VALIDATE** — requirements-validator swarm → score ≥70
3. **IMPLEMENT** — parallel agents from validated docs
4. **REVIEW** — brutal-honesty-review swarm → fix all criticals

Available lifecycle skills in `.claude/skills/`:
- `sparc-prd-mini` (orchestrator, delegates to explore, goap-research-ed25519, problem-solver-enhanced)
- `explore` (Socratic questioning → Product Brief)
- `goap-research-ed25519` (GOAP A* + OODA → Research Findings)
- `problem-solver-enhanced` (9 modules + TRIZ → Solution Strategy)
- `requirements-validator`
- `brutal-honesty-review`

## 🚀 Automation Commands

- `/go [feature]` — auto-select pipeline (/plan, /feature) and implement
- `/run` or `/run mvp` — bootstrap + implement all MVP features in a loop
- `/run all` — bootstrap + implement ALL features
- `/docs` — generate bilingual documentation (RU/EN) in /README/
- `/docs update` — update existing documentation

## 📋 Feature Roadmap

Roadmap: [.claude/feature-roadmap.json](.claude/feature-roadmap.json) — single source of truth for feature status.
Sprint progress and next steps are injected automatically at session start.
Quick check: `/next` | Full overview: ask "what should I work on?"
Mark done: `/next [feature-id]` | Update all: `/next update`

## 📝 Implementation Plans

Plans: [docs/plans/](docs/plans/) — lightweight implementation plans.
Create: `/plan <feature-name>` | List: `/plan list` | Mark done: `/plan done <slug>`
For full feature lifecycle (10 docs, 4 phases): `/feature <n>`

## Resources

- [docs/PRD.md](docs/PRD.md) — features, pricing, timeline
- [docs/Architecture.md](docs/Architecture.md) — system design, Docker Compose, SQL DDL
- [docs/Specification.md](docs/Specification.md) — user stories, API, data model
- [docs/Pseudocode.md](docs/Pseudocode.md) — core algorithms
- [docs/Refinement.md](docs/Refinement.md) — edge cases, test strategy, ADRs
- [docs/Completion.md](docs/Completion.md) — deploy plan, CI/CD, monitoring
- [docs/validation-report.md](docs/validation-report.md) — validation results (🟡 CAVEATS, 87/100)
- [docs/test-scenarios.md](docs/test-scenarios.md) — 70 BDD scenarios

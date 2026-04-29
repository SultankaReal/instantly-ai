# Project: Поток

## Overview

Поток — SaaS-платформа для холодного email outreach с прогревом Яндекс/Mail.ru, AI Reply Agent и multi-client агентским режимом. Flat-price без per-seat надбавок. 38-ФЗ compliant.

**One-Liner:** Единственный сервис в России: прогрев Яндекс/Mail.ru + AI Reply Agent + unlimited аккаунты + flat ₽ price.

**Pricing:** ₽1,990/₽4,990/₽9,990 per month (Старт/Про/Агентство) | Trial 7 дней бесплатно.

**MVP:** Email account management, Warmup Engine, Inbox Score, Campaign Engine, Unified Inbox, Billing (YooKassa).
**v1.0:** AI Reply Agent, Multi-client Agency Cabinet, amoCRM/Bitrix24 integration.

## Architecture

```
Distributed Monolith (Monorepo) — Docker Compose on VPS (AdminVPS/HOSTKEY)

apps/
  api/        — Fastify v5 + TypeScript, REST API, JWT auth, Port :3000
  web/        — Next.js 15 App Router SSR+CSR, Port :3001
  worker/     — BullMQ workers: warmup, campaigns, billing, AI reply
packages/
  shared-types/     — TypeScript types, Zod schemas

Infrastructure: Nginx → [api :3000, web :3001] | PostgreSQL 16 | Redis 7 | MinIO | Prometheus + Grafana (:3002)
```

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| API | Fastify v5 + TypeScript | High throughput for email processing |
| Frontend | Next.js 15 (App Router) | SSR для landing; CSR для dashboard |
| Database | PostgreSQL 16 + Prisma 5 | ACID; Prisma type-safe queries |
| Queue | BullMQ + Redis 7 | Warmup scheduling, campaign batching |
| Email I/O | Nodemailer (SMTP) + imapflow (IMAP) | Direct Яндекс/Mail.ru integration |
| Payments | YooKassa (YooMoney) | RU cards + СБП + T-Pay |
| AI | Claude API (claude-sonnet-4-6) | AI Reply Agent classification + drafts |
| Storage | MinIO (S3-compatible) | Self-hosted on VPS |
| Monitoring | Prometheus + Grafana (:3002) | Warmup metrics + billing alerts |

## Key Algorithms

```typescript
// Warmup ramp-up: days 1-7: 5-10, days 8-14: 20-40, days 15-21: 40-100, days 22+: 100-200
getDailyVolume(warmupDay: number): number

// Inbox Score: (50% × 7d_rate) + (30% × 14d_rate) + (20% × 30d_rate)
recalculateInboxScore(accountId: UUID): Promise<number>

// Credentials always AES-256-GCM encrypted at rest
processWarmupSend(job: WarmupJob): Promise<void>

// Campaign sequence with reply detection → stop follow-ups
processEmailSend(job: EmailSendJob): Promise<void>

// AI classification via Claude API → autopilot / draft / manual
classifyReply(body: string): Promise<{ category: string, confidence: number }>

// 38-ФЗ: server-side append unsubscribe link with HMAC token
appendUnsubscribeLink(html: string, contactId: UUID): string

// YooKassa webhook: crypto.timingSafeEqual HMAC verification
handleYooKassaWebhook(body: Buffer, digest: string): Promise<void>
```

## Security Rules

⚠️ **Critical — always enforce:**
- JWT HS256: access token 15min, refresh 7 days, Redis blacklist for logout
- Passwords: bcrypt cost factor 12 minimum
- Email credentials: AES-256-GCM encrypted BYTEA — never plaintext
- Rate limiting: 100/min anonymous, 1000/min authenticated, 10/hr AI generation
- Input validation: Zod schemas at ALL API boundaries (never trust request body)
- HTML content: DOMPurify on ALL user-generated HTML before storage and render
- YooKassa webhook: `crypto.timingSafeEqual()` for HMAC — never skip
- SQL: Prisma ORM only — never string concatenation in queries
- Multi-tenant: every query filters by userId — never trust client-provided IDs alone
- Secrets: env vars only (`${VAR}` in docker-compose) — never hardcode
- 38-ФЗ: unsubscribe link MUST be appended server-side to every campaign email

## Parallel Execution Strategy

- Use `Task` tool for independent subtasks
- Run tests, linting, type-checking in parallel
- For complex features: spawn specialized agents
- Phase 2 of /start: 4 parallel Tasks (api, web, worker, shared-types)

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

| Agent | Trigger | Source |
|-------|---------|--------|
| `@planner` | Break down features from Pseudocode.md into tasks | Pseudocode.md |
| `@code-reviewer` | Review code quality, edge cases from Refinement.md | Refinement.md |
| `@architect` | Verify architecture consistency | Architecture.md + Solution_Strategy.md |

## Available Skills

**Lifecycle skills** (`.claude/skills/`):
- `sparc-prd-mini` — full SPARC documentation generator (orchestrator)
- `explore` — Socratic questioning → Product Brief
- `goap-research-ed25519` — GOAP A* + OODA → Research Findings
- `problem-solver-enhanced` — 9 modules + TRIZ → Solution Strategy
- `requirements-validator` — swarm validation (INVEST/SMART, 5 agents)
- `brutal-honesty-review` — rigorous post-implementation review

**Project skills** (`.claude/skills/`):
- `project-context` — domain knowledge (Яндекс/Mail.ru SMTP/IMAP, YooKassa, BullMQ warmup)
- `coding-standards` — Fastify v5/Next.js 15/Prisma 5 patterns
- `testing-patterns` — Vitest + Playwright + Testcontainers patterns
- `security-patterns` — JWT/AES-256-GCM/HMAC webhook security patterns
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

## 🚀 Automation Commands

- `/go [feature]` — auto-select pipeline (/plan, /feature) and implement
- `/run` or `/run mvp` — bootstrap + implement all MVP features in a loop
- `/run all` — bootstrap + implement ALL features
- `/docs` — generate bilingual documentation (RU/EN) in /README/
- `/docs update` — update existing documentation

## 📋 Feature Roadmap

Roadmap: [.claude/feature-roadmap.json](.claude/feature-roadmap.json) — single source of truth for feature status.
Quick check: `/next` | Full overview: ask "what should I work on?"
Mark done: `/next [feature-id]` | Update all: `/next update`

## 📝 Implementation Plans

Plans: [docs/plans/](docs/plans/) — lightweight implementation plans.
Create: `/plan <feature-name>` | List: `/plan list` | Mark done: `/plan done <slug>`
For full feature lifecycle (10 docs, 4 phases): `/feature <n>`

## Resources

- [docs/PRD.md](docs/PRD.md) — features, pricing, timeline
- [docs/Architecture.md](docs/Architecture.md) — system design, Docker Compose, SQL DDL
- [docs/Specification.md](docs/Specification.md) — user stories (17), API contracts, data model
- [docs/Pseudocode.md](docs/Pseudocode.md) — core algorithms (warmup, campaigns, billing, AI)
- [docs/Refinement.md](docs/Refinement.md) — edge cases (D1-D9), test strategy, ADRs
- [docs/Completion.md](docs/Completion.md) — deploy plan, CI/CD, monitoring
- [docs/validation-report.md](docs/validation-report.md) — validation results (🟡 CAVEATS, 84/100)
- [docs/test-scenarios.md](docs/test-scenarios.md) — 70 BDD scenarios (Gherkin)

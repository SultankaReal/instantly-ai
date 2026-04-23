# Inkflow

**SaaS newsletter platform — 0% platform commission, native SEO, AI writing assistant.**

Built as an alternative to Substack. Authors keep 100% of revenue minus Stripe fees.
Flat SaaS pricing: $0 / $29 / $79 / $149/mo.

## Why Inkflow

| | Inkflow | Substack | beehiiv |
|--|---------|----------|---------|
| **Platform commission** | **0%** | 10% | 0% (but $42-249/mo) |
| **SEO** | ✅ Next.js SSR | ❌ | ✅ |
| **AI tools** | ✅ Claude API | ❌ | ❌ |
| **Pricing** | $0-149/mo flat | % of revenue | $42-249/mo |

## Tech Stack

- **API:** Fastify + TypeScript
- **Frontend:** Next.js 15 App Router (SSR for SEO)
- **Database:** PostgreSQL 16 + Prisma
- **Queue:** BullMQ + Redis 7
- **Email:** Postmark + Resend fallback
- **Payments:** Stripe (global) + CloudPayments (RU)
- **AI:** Claude API (claude-sonnet-4-6)
- **Infrastructure:** Docker Compose on VPS (AdminVPS/HOSTKEY)

## Quick Start (Development)

```bash
# Bootstrap project from documentation
/start

# Or run autonomous MVP build
/run mvp
```

## Available Commands

| Command | Description |
|---------|-------------|
| `/start` | Bootstrap full project (monorepo → Docker → DB → health check) |
| `/run mvp` | Autonomous loop: bootstrap + all MVP features |
| `/run all` | Autonomous loop: ALL features |
| `/go [feature]` | Implement one feature (auto-selects /plan or /feature) |
| `/feature [name]` | Full 4-phase SPARC lifecycle |
| `/plan [name]` | Lightweight plan for simple tasks |
| `/next` | Show feature roadmap + next priority |
| `/test` | Run test suite |
| `/deploy [env]` | Deploy to staging/production |
| `/docs` | Generate bilingual documentation (RU/EN) |
| `/myinsights` | Capture development insight |
| `/harvest` | Extract project knowledge |

## Architecture

```
Distributed Monolith (Monorepo) — Docker Compose on VPS

apps/api/        — Fastify REST API (port 3000)
apps/web/        — Next.js 15 frontend (port 3001)
apps/worker/     — BullMQ email queue worker
packages/
  shared-types/        — TypeScript types, Zod schemas
  email-templates/     — React Email templates
```

## MVP Features

1. **Publishing** — Rich text editor, autosave, schedule, send
2. **Subscriber Management** — Email signup, double opt-in, unsubscribe
3. **Paid Subscriptions** — Stripe Checkout, 0% commission, paywall
4. **SEO-Native Posts** — Next.js ISR, auto meta/OG/Article schema
5. **Analytics** — Open/click rates, subscriber growth
6. **Substack Import** — ZIP upload, CSV parse, migration

## Documentation

- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) — development workflow
- [CLAUDE.md](CLAUDE.md) — Claude Code context
- [docs/](docs/) — full SPARC documentation (PRD, Architecture, Specification, etc.)
- [docs/validation-report.md](docs/validation-report.md) — validation results (87/100)

## ⚠️ Known Pre-Launch Requirements

1. Non-RU legal entity (Cyprus/UAE) — required for Stripe
2. GDPR consent_log + deletion/export — before EU user acquisition
3. Stripe webhook idempotency (stripe_event_id) — before production payments

---

> ⚠️ Market projections and financial targets are estimates. Validate with domain experts before capital allocation decisions.

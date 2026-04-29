# Поток — Cold Email Outreach Platform

> Единственный сервис в России: прогрев Яндекс/Mail.ru + AI Reply Agent + unlimited аккаунты + flat ₽ price.

## Overview

**Поток** — SaaS-платформа для холодного email outreach с прогревом Яндекс/Mail.ru, AI Reply Agent и multi-client агентским режимом.

| | |
|-|-|
| **Pricing** | ₽1,990 / ₽4,990 / ₽9,990 per month |
| **Plans** | Старт (3 аккаунта) / Про (10 аккаунтов) / Агентство (unlimited) |
| **Compliance** | 38-ФЗ (one-click unsubscribe) |
| **Payments** | YooKassa (СБП, T-Pay, банковские карты) |

## Quick Start

```bash
git clone git@github.com:SultankaReal/instantly-ai.git
cd instantly-ai
cp .env.example .env  # Fill secrets (see .env.example)
```

See [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) for full setup.

## Architecture

```
Distributed Monolith (Monorepo) — Docker Compose on VPS

apps/api/     Fastify v5 + TypeScript    :3000
apps/web/     Next.js 15 App Router      :3001  
apps/worker/  BullMQ processors          —

Infrastructure: Nginx → api/web | PostgreSQL 16 | Redis 7 | MinIO | Prometheus/Grafana
```

## Development

```bash
/start          # Bootstrap monorepo + Docker + DB
/run mvp        # Autonomous MVP implementation loop
/go [feature]   # Implement one feature with full SPARC lifecycle
/next           # Show roadmap and next priority
```

## Documentation

| Document | Content |
|----------|---------|
| [docs/PRD.md](docs/PRD.md) | Product requirements, pricing, roadmap |
| [docs/Architecture.md](docs/Architecture.md) | System design, Docker Compose, SQL DDL |
| [docs/Specification.md](docs/Specification.md) | 17 user stories, API contracts |
| [docs/Pseudocode.md](docs/Pseudocode.md) | Core algorithms (warmup, campaigns, billing, AI) |
| [docs/Refinement.md](docs/Refinement.md) | Edge cases D1-D9, test strategy |
| [docs/test-scenarios.md](docs/test-scenarios.md) | 70 BDD Gherkin scenarios |
| [docs/validation-report.md](docs/validation-report.md) | 🟡 CAVEATS — 84/100 |

## Feature Roadmap

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | Auth Module (US-01-03) | ⏳ pending |
| P0 | Email Account Management (US-04-05) | ⏳ pending |
| P1 | Warmup Engine (US-06) | ⏳ pending |
| P1 | Inbox Score (US-07-09) | ⏳ pending |
| P2 | Campaign Engine (US-10-12) | ⏳ pending |
| P2 | YooKassa Billing (US-15-17) | ⏳ pending |
| P3 | Unified Inbox (US-13-14) | ⏳ pending |
| P3 | AI Reply Agent (v1.0) | ⏳ pending |

## Security

- AES-256-GCM encryption for all email credentials
- bcrypt cost factor 12 for passwords
- JWT 15min access / 7d refresh with Redis blacklist
- YooKassa webhook HMAC verification with `timingSafeEqual`
- 38-ФЗ compliant unsubscribe in every campaign email
- Multi-tenant isolation: every DB query includes userId filter

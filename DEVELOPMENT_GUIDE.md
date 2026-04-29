# Development Guide — Поток

## Getting Started

```bash
git clone git@github.com:SultankaReal/instantly-ai.git
cd instantly-ai
cp .env.example .env  # Fill in all secrets
/start               # Bootstrap monorepo + Docker + DB
```

## Development Workflow

### Implementing a Feature

```
1. Check roadmap:    /next
2. Start feature:    /go [feature-name]
   - Auto-selects:   /feature (new story) or /plan (small task)
3. Implement:        guided by Pseudocode.md algorithms
4. Test:             /test + /test integration
5. Review:           /feature review (brutal-honesty-review)
6. Deploy:           /deploy staging → validate → /deploy production
```

### Manual Feature Lifecycle

```bash
# Full 4-phase SPARC lifecycle
/feature warmup-engine

# Lightweight plan for small tasks
/plan fix-warmup-volume-calculation

# Autonomous loop for all MVP features
/run mvp
```

## Project Structure

```
instantly-ai/
├── CLAUDE.md                    # AI instructions + architecture overview
├── DEVELOPMENT_GUIDE.md         # This file
├── .env.example                 # Environment variables template
├── docker-compose.yml           # All services (nginx, api, web, worker, pg, redis, minio, grafana)
├── apps/
│   ├── api/                     # Fastify v5 + TypeScript (:3000)
│   ├── web/                     # Next.js 15 App Router (:3001)
│   └── worker/                  # BullMQ processors
├── packages/
│   └── shared-types/            # TypeScript types + Zod schemas
├── docs/
│   ├── PRD.md                   # Product requirements
│   ├── Architecture.md          # System design + DDL
│   ├── Specification.md         # 17 user stories + API contracts
│   ├── Pseudocode.md            # Core algorithms
│   ├── Refinement.md            # Edge cases D1-D9
│   ├── Completion.md            # Deploy runbook + CI/CD
│   ├── test-scenarios.md        # 70 BDD Gherkin scenarios
│   ├── validation-report.md     # 🟡 CAVEATS, 84/100
│   ├── features/                # Per-feature SPARC docs
│   └── plans/                   # Lightweight implementation plans
├── tests/
│   ├── integration/             # Vitest + testcontainers
│   ├── e2e/                     # Playwright golden paths
│   └── performance/             # k6 load tests
├── myinsights/
│   └── 1nsights.md              # Error index — check FIRST before debugging
└── .claude/
    ├── agents/                  # planner, code-reviewer, architect
    ├── commands/                # /start, /feature, /go, /run, /plan, /test, /deploy, /next
    ├── rules/                   # security, coding-style, git-workflow, testing, feature-lifecycle
    ├── skills/                  # lifecycle + project-specific skills
    ├── settings.json            # Hooks (auto-commit insights)
    └── feature-roadmap.json     # Feature status tracker
```

## Key Algorithms Reference

All algorithms are in `docs/Pseudocode.md`. Never implement from memory — always read first.

| Algorithm | Pseudocode Section | Critical Notes |
|-----------|-------------------|----------------|
| Warmup ramp-up | §3 processWarmupSend | Load senderAccount + partnerAccount explicitly |
| Inbox Score | §4 recalculateInboxScore | Formula: 50%/30%/20% for 7d/14d/30d |
| Campaign send | §5 processEmailSend | Exclude unsubscribes BEFORE queuing |
| AI Reply | §6 processAIReply | Check ai_reply_enabled flag first |
| YooKassa billing | §7 handleYooKassaWebhook | timingSafeEqual, yookassa_event_id idempotency |
| Auth | §1 register/login/refresh | bcrypt 12, blacklist on logout |

## Security Checklist (before every PR)

- [ ] AES-256-GCM for email credentials
- [ ] bcrypt cost 12 for passwords
- [ ] JWT 15min access / 7d refresh / Redis blacklist
- [ ] YooKassa HMAC with timingSafeEqual
- [ ] 38-ФЗ unsubscribe link in every campaign email
- [ ] Zod validation at all API boundaries
- [ ] DOMPurify on all user HTML
- [ ] Multi-tenant: userId filter on every DB query

## Environment Setup

```bash
# Generate secrets
openssl rand -hex 32  # JWT_SECRET
openssl rand -hex 32  # JWT_REFRESH_SECRET
openssl rand -hex 32  # ENCRYPTION_KEY (for AES-256-GCM)

# Docker services
docker compose up -d

# Database
docker compose exec api npx prisma migrate deploy

# Health checks
curl http://localhost:3000/health  # API
curl http://localhost:3001         # Web
```

## Monitoring

- Grafana: http://localhost:3002 (admin/admin)
- Dashboards: Warmup Metrics, Campaign Funnel, System Health, Billing
- Alerts: score_drop < 70, high bounce > 5%, disk > 80%

## Useful Commands

```bash
# Run tests
npm run test                 # Unit tests
npm run test:integration     # Integration (needs Docker)
npm run test:e2e             # E2E Playwright

# Database
npx prisma studio            # DB browser
npx prisma migrate dev       # New migration
npx prisma generate          # Regenerate client

# BullMQ
# bull-board: http://localhost:3000/admin/queues

# Logs
docker compose logs -f api   # API logs
docker compose logs -f worker # Worker logs
```

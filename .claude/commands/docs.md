---
description: Generate or update project documentation in Russian and English.
  Creates a comprehensive set of markdown files covering deployment, usage,
  architecture, and user flows.
  $ARGUMENTS: optional flags — "rus" (Russian only), "eng" (English only), "update" (refresh existing)
---

# /docs $ARGUMENTS

## Purpose

Generate professional, bilingual project documentation from source code,
existing docs, and development insights. Output: `README/rus/` and `README/eng/`.

## Step 1: Gather Context

Read all available sources:

```
docs/PRD.md                    — product requirements, features
docs/Architecture.md            — system architecture, tech stack
docs/Specification.md           — API, data model, user stories
docs/Completion.md              — deployment, environment setup
docs/features/                  — feature-specific documentation
CLAUDE.md                       — project overview, commands
DEVELOPMENT_GUIDE.md            — development workflow
docker-compose.yml              — infrastructure services
.env.example                    — environment variables (if exists)
myinsights/1nsights.md          — development insights (gotchas)
.claude/feature-roadmap.json    — feature list and statuses
```

## Step 2: Determine Scope

```
IF $ARGUMENTS contains "rus":  languages = ["rus"]
ELIF $ARGUMENTS contains "eng": languages = ["eng"]
ELSE: languages = ["rus", "eng"]

IF $ARGUMENTS contains "update": mode = "update"
ELSE: mode = "create"
```

## Step 3: Generate Documentation Set

For EACH language, generate 7 files:

### `deployment.md` — Как развернуть систему / Deployment Guide
- Requirements (OS, Docker, Node.js versions)
- Quick start: clone → configure → `docker compose up`
- Environment variables explanation (from .env.example)
- Full production deployment (VPS setup, SSL, Nginx)
- Database initialization (Prisma migrate)
- Updating + rollback procedure

### `admin-guide.md` — Руководство администратора / Admin Guide
- User management
- Monitoring: Prometheus + Grafana dashboards
- Email delivery: Postmark dashboard, bounce handling
- Payments: Stripe dashboard, webhook logs
- Backup procedures (daily cron to MinIO)
- Troubleshooting: common issues from myinsights/

### `user-guide.md` — Руководство пользователя / User Guide
- Registration + first publication setup
- Writing and publishing a post
- Managing subscribers
- Enabling paid subscriptions (Stripe connect)
- Viewing analytics
- Importing from Substack
- Using AI writing assistant

### `infrastructure.md` — Требования к инфраструктуре / Infrastructure Requirements
- Minimum: 2 vCPU, 4GB RAM, 40GB SSD
- Recommended production: 4 vCPU, 8GB RAM, 100GB SSD
- Ports: 80, 443, 22 (restrict to admin IPs)
- External services: Stripe, Postmark, Cloudflare, Claude API
- DNS requirements: DMARC/DKIM/SPF records

### `architecture.md` — Архитектура системы / Architecture
- Distributed Monolith diagram (Mermaid)
- Component responsibilities
- Tech stack rationale (from docs/Refinement.md ADRs)
- Data model overview
- Security architecture

### `ui-guide.md` — Интерфейс системы / UI Guide
- Dashboard navigation
- Editor features
- Analytics views
- Subscriber management UI
- Settings screens

### `user-flows.md` — Пользовательские сценарии / User Flows
- Flow: Author registration → first post → send to subscribers (Mermaid sequence)
- Flow: Reader subscription confirmation
- Flow: Paid subscription checkout
- Flow: Substack migration import
- Admin flow: monitoring + incident response

## Step 4: Generate Output

```bash
mkdir -p README/rus README/eng
```

Also generate `README/index.md`:
```markdown
# Inkflow Documentation

## 🇷🇺 Документация на русском
- [Развертывание](rus/deployment.md)
- [Руководство администратора](rus/admin-guide.md)
- [Руководство пользователя](rus/user-guide.md)
- [Требования к инфраструктуре](rus/infrastructure.md)
- [Архитектура](rus/architecture.md)
- [Интерфейс](rus/ui-guide.md)
- [Пользовательские сценарии](rus/user-flows.md)

## 🇬🇧 English Documentation
- [Deployment Guide](eng/deployment.md)
- [Administrator Guide](eng/admin-guide.md)
- [User Guide](eng/user-guide.md)
- [Infrastructure Requirements](eng/infrastructure.md)
- [Architecture](eng/architecture.md)
- [UI Guide](eng/ui-guide.md)
- [User & Admin Flows](eng/user-flows.md)
```

## Step 5: Commit

```bash
git add README/
git commit -m "docs: generate project documentation (RU/EN)"
git push origin HEAD
```

## Update Mode

When `$ARGUMENTS` contains "update":
1. Read existing `README/` files
2. Compare with current project state
3. Update only changed sections
4. Preserve manual additions
5. Commit: `docs: update project documentation`

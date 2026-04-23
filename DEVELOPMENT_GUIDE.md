# Development Guide — Inkflow

## Quick Start

```bash
# 1. Bootstrap the entire project from documentation
/start

# 2. Verify services are running
docker compose ps
curl http://localhost:3000/api/health

# 3. Start autonomous MVP build
/run mvp
```

## Command Hierarchy

```
/run mvp
  └── /start (bootstrap if needed)
  └── LOOP until all MVP features done:
      ├── /next           — find highest-priority next feature
      └── /go <feature>   — analyze complexity, select pipeline, implement
          ├── /plan        — simple tasks (score ≤ -2)
          └── /feature     — all features (score > -2)
              ├── Phase 1: PLAN      (sparc-prd-mini)
              ├── Phase 2: VALIDATE  (requirements-validator swarm)
              ├── Phase 3: IMPLEMENT (parallel agents)
              └── Phase 4: REVIEW    (brutal-honesty-review swarm)
```

## Single Feature

```bash
/go subscriber-management    # Auto-selects pipeline and implements
/go F3                       # By roadmap ID
/feature paid-subscriptions  # Force full SPARC lifecycle
/plan fix-redis-timeout      # Lightweight plan for simple fixes
```

## Full Autonomous Build

```bash
/run                # Bootstrap + implement MVP features → tag v0.1.0-mvp
/run mvp            # Same as above
/run all            # Bootstrap + implement ALL features → tag v1.0.0
```

## Feature Roadmap

```bash
/next               # Show current sprint status + next feature
/next F1            # Mark F1 as done
/next update        # Sync status from code + git history
```

Check `.claude/feature-roadmap.json` for full feature list and dependencies.

## MVP Feature Order (recommended)

1. `F2` — subscriber-management ← **start here** (foundational, no deps)
2. `F1` — publishing (requires F2)
3. `F6` — substack-import (requires F2, standalone)
4. `F4` — seo-native-posts (requires F1, apps/web only)
5. `F3` — paid-subscriptions (requires F1 + F2, **critical path to revenue**)
6. `F5` — analytics (requires F1 + F2)

## Testing

```bash
npm run test              # Unit tests (Vitest)
npm run test:integration  # Integration (Testcontainers, requires Docker)
npm run test:e2e          # E2E (Playwright, requires running app)
npm run test:coverage     # Coverage report (target: ≥80%)

/test                     # All tests via command
/test coverage            # Coverage report
/test subscriber-management  # Feature-specific tests
```

## Development Workflow

### Starting a new feature

```bash
/go <feature-name>
# or explicitly:
/feature <feature-name>    # Full SPARC lifecycle
/plan <simple-task>        # Lightweight for small changes
```

### During development

```bash
# Check architecture consistency
@architect does this approach fit?

# Break down complex task
@planner break this into tasks

# Review code quality
@code-reviewer review the subscriber service
```

### After implementation

```bash
/myinsights "issue title"  # Capture any tricky bugs/decisions
/test                      # Run full test suite
git push origin HEAD       # Push to remote
```

## Deployment

```bash
/deploy staging       # Deploy to staging VPS
/deploy production    # Zero-downtime production deploy
/deploy rollback      # Rollback to previous version
```

## Documentation

```bash
/docs                 # Generate bilingual docs (RU + EN)
/docs rus             # Russian only
/docs update          # Update existing docs
```

## Knowledge Base

```bash
/myinsights "title"          # Capture a new insight
/myinsights archive INS-001  # Archive obsolete insight
/harvest                     # Extract project knowledge to reusable toolkit
```

On session end, the Stop hook auto-commits:
- `myinsights/` changes → `docs(insights): update knowledge base`
- `.claude/feature-roadmap.json` changes → `docs(roadmap): update feature status`
- `docs/plans/` changes → `docs(plans): update implementation plans`

## Architecture Quick Reference

```
apps/api/     — Fastify + TypeScript (port 3000)
  ├── routes/  — HTTP handlers (thin layer)
  ├── services/ — business logic (testable, no framework deps)
  ├── plugins/ — Fastify plugins (auth, db, redis)
  └── prisma/  — schema + migrations

apps/web/     — Next.js 15 App Router (port 3001)
  ├── app/(public)/    — publication pages (SSR for SEO)
  ├── app/(dashboard)/ — author dashboard (client-heavy)
  └── components/      — React components

apps/worker/  — BullMQ workers
  ├── workers/ — job processors (email-send, import)
  └── queues/  — queue definitions

packages/shared-types/  — TypeScript types, Zod schemas
packages/email-templates/ — React Email templates
```

## Critical Pre-Launch Checklist

From `docs/validation-report.md`:

- [ ] **GDPR:** Implement consent_log + deletion/export endpoints before EU user acquisition
- [ ] **Stripe idempotency:** Add stripe_event_id deduplication before production payments
- [ ] **Postmark webhook auth:** Verify X-Postmark-Signature in production webhook handler
- [ ] **ZIP bomb protection:** Max uncompressed size check in Substack import
- [ ] **Non-RU legal entity:** Required before Stripe goes live (Cyprus/UAE)
- [ ] **Confirmation token expiry:** Run migration to add `confirmation_token_expires_at` column

## Key NFR Targets

| Target | Value | How to Check |
|--------|-------|-------------|
| API p99 latency | < 200ms | Grafana → API latency panel |
| Email delivery | < 5 min | Postmark queue metrics |
| Web LCP | < 1.5s | `npm run test:lighthouse` |
| Uptime | ≥ 99.5% | Uptime Robot |
| Test coverage | ≥ 80% | `npm run test:coverage` |

## Useful Resources

- [docs/Architecture.md](docs/Architecture.md) — Docker Compose, SQL DDL, security
- [docs/Specification.md](docs/Specification.md) — User stories, API endpoints, data model
- [docs/Pseudocode.md](docs/Pseudocode.md) — Core algorithms
- [docs/Refinement.md](docs/Refinement.md) — Edge cases, ADRs
- [docs/validation-report.md](docs/validation-report.md) — Known caveats
- [.claude/feature-roadmap.json](.claude/feature-roadmap.json) — Feature priorities

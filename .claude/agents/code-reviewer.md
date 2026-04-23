---
name: code-reviewer
description: Code review agent for Inkflow. Reviews implementation against SPARC docs,
  Refinement.md edge cases, and Security NFRs. Use after implementing a feature or
  before merging to main. Provides actionable, specific feedback — no sugar-coating.
---

# Code Reviewer Agent — Inkflow

## Role

Rigorous post-implementation review using Inkflow's SPARC documentation as the standard.
Reviews code quality, security, performance, and test coverage.

## When to Invoke

- After completing feature implementation (Phase 4 of /feature)
- Before merging any PR to main
- When something "feels wrong" about existing code
- Scheduled: before any production deployment

## Review Checklist

### 1. Requirements Coverage

Cross-check implementation against docs:
- [ ] All acceptance criteria from `docs/Specification.md` user stories are implemented
- [ ] All algorithms from `docs/Pseudocode.md` are correctly implemented
- [ ] Edge cases from `docs/Refinement.md` are handled
- [ ] BDD scenarios from `docs/test-scenarios.md` have corresponding tests

### 2. Security Review (from `.claude/rules/security.md`)

- [ ] JWT verification on all protected routes — no missing auth middleware
- [ ] Stripe webhook: `constructEvent()` with raw body and signature
- [ ] Postmark webhook: shared-secret header verified before processing
- [ ] Zod schemas present on ALL API boundaries (no unvalidated req.body)
- [ ] DOMPurify applied to all user-generated HTML
- [ ] Multi-tenant isolation: every query filters by `publication_id`
- [ ] Rate limiting in place for AI endpoints (10/hr per author)
- [ ] Server-side content truncation in `getPostContent()` — not just frontend overlay
- [ ] No secrets hardcoded (grep for API keys, tokens, passwords in code)
- [ ] Confirmation tokens: single-use, properly invalidated

### 3. Code Quality (from `.claude/rules/coding-style.md`)

- [ ] TypeScript strict — no `any`, no implicit types on public functions
- [ ] Fastify routes: Zod schema declared, error handler called
- [ ] Next.js: `generateMetadata()` on all public pages
- [ ] Prisma: `$transaction()` for multi-step operations
- [ ] BullMQ jobs: idempotent (safe to retry)
- [ ] No string concatenation in SQL/Prisma queries
- [ ] Functions named clearly — no ambiguous names
- [ ] No dead code, no commented-out blocks

### 4. Performance (from `docs/Refinement.md`)

- [ ] Database queries: no N+1 queries (check for missing `include`/`select`)
- [ ] Email batch size: 1000 per job (not entire list in one call)
- [ ] Analytics aggregation: uses indexed `(post_id, event_type)` — not full table scan
- [ ] API response: no unnecessary data in responses (select only needed fields)
- [ ] ISR configured on Next.js pages: `revalidate: 300` on post pages

### 5. Test Coverage

- [ ] Unit tests for all new service functions
- [ ] Integration tests for new API routes
- [ ] Security test: unauthorized access attempt returns 401/403
- [ ] Error path test: external API failure handled gracefully
- [ ] Edge case coverage (from docs/Refinement.md edge cases section)

## Output Format

```markdown
## Code Review: <feature-name>

**Overall:** 🟢 READY | 🟡 MINOR ISSUES | 🔴 NEEDS WORK

### 🔴 Critical (blocking)
- [File:Line] Issue description — fix required before merge

### 🟡 Important (should fix)
- [File:Line] Issue description — fix recommended

### 🟢 Minor (optional)
- [File:Line] Suggestion

### ✅ What's Good
- [Specific positive observations]

### Test Coverage
- Unit: N% (target: ≥80%)
- Integration: N scenarios covered
- Missing: [specific gaps]
```

## Common Inkflow-Specific Issues to Watch

1. **Webhook handlers** — always check for signature verification first
2. **Subscriber queries** — always include `publication_id` filter (multi-tenant)
3. **Paywall** — server-side truncation in service, not just CSS overlay
4. **BullMQ jobs** — must be idempotent; check for `moveToFailed` on retries
5. **Redis auth** — URL must be `redis://:${REDIS_PASSWORD}@redis:6379` (not `redis://redis:6379`)
6. **Stripe idempotency** — add `stripe_event_id` deduplication (known gap from validation-report.md)

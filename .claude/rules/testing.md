# Testing Rules — Inkflow

Source: `docs/Refinement.md` test strategy.

## Test Pyramid

```
          E2E (5%)
       Integration (25%)
    Unit Tests (70%)
```

## Frameworks

- **Unit/Integration**: Vitest (`vitest.config.ts`)
- **E2E**: Playwright (`playwright.config.ts`)
- **Integration DB**: `testcontainers` (real PostgreSQL, not mocks)
- **Performance**: k6 (`tests/performance/`)
- **Coverage target**: ≥ 80% line coverage

## Unit Tests (70%)

What to unit test:
- All service functions (sendPost, subscribe, generateSEOMetadata, etc.)
- Zod schema validation edge cases
- JWT token logic
- Utility functions in packages/shared-types

Rules:
- Mock only external services (Postmark, Stripe API calls)
- Never mock the database — use testcontainers for anything hitting DB
- Test file co-located: `src/services/send-post.service.test.ts`

## Integration Tests (25%)

What to integration test:
- API endpoints (full request-response cycle)
- Prisma queries against real PostgreSQL (testcontainers)
- BullMQ job processing
- Webhook handlers (Stripe, Postmark)

Rules:
- Use `testcontainers` for PostgreSQL and Redis
- Seed test data in `beforeEach`, clean in `afterEach`
- Test both happy path AND error cases
- Integration tests in `tests/integration/`

## E2E Tests (5%)

Golden paths (Playwright):
1. Author registration → create publication → publish post → verify email sent
2. Reader subscribe → confirm email → receive post
3. Author enable paid subscription → reader checkout → access paid post
4. Substack import → verify subscriber count

Rules:
- E2E tests in `tests/e2e/`
- Use real browser (Chromium)
- Lighthouse CI in GitHub Actions (LCP < 1.5s assertion)

## BDD Scenarios

70 Gherkin scenarios are available in `docs/test-scenarios.md`.
Prioritize implementing integration/E2E tests for:
1. US-04 (subscribe/confirm/unsubscribe) — security-critical token flow
2. US-06 (Stripe webhook) — payments
3. US-07 (paywall) — server-side content access control

## Test Commands

```bash
# Unit tests
npm run test                    # Run all unit tests
npm run test:watch              # Watch mode
npm run test:coverage           # Coverage report

# Integration tests  
npm run test:integration        # Requires Docker (testcontainers)

# E2E tests
npm run test:e2e                # Requires running app
npm run test:e2e:headed         # Visible browser

# Performance
npm run test:perf               # k6 load tests (requires k6 installed)
```

## Never

- Never mock the database in integration tests — we got burned on this pattern
- Never skip tests to make a deadline — mark as `todo` with a clear ticket
- Never test implementation details — test behavior

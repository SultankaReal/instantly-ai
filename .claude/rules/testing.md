# Testing Rules — Поток

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
- **Integration DB**: `testcontainers` (real PostgreSQL + Redis, not mocks)
- **Performance**: k6 (`tests/performance/`)
- **Coverage target**: ≥ 80% line coverage

## Unit Tests (70%)

What to unit test:
- All service functions (getDailyVolume, recalculateInboxScore, appendUnsubscribeLink, etc.)
- Zod schema validation edge cases
- JWT token logic
- AES-256-GCM encrypt/decrypt roundtrip
- YooKassa HMAC signature verification
- Utility functions in packages/shared-types

Rules:
- Mock only external services (Nodemailer, Claude API, YooKassa API calls)
- **Never mock the database** — use testcontainers for anything hitting DB
- Test file co-located: `src/services/warmup.service.test.ts`

## Integration Tests (25%)

What to integration test:
- API endpoints (full request-response cycle with real DB)
- Prisma queries against real PostgreSQL (testcontainers)
- BullMQ job processing (warmup, campaign, billing)
- Webhook handlers (YooKassa)
- Unsubscribe flow (token generation → DB write → exclusion from send queue)

Rules:
- Use `testcontainers` for PostgreSQL and Redis
- Seed test data in `beforeEach`, clean in `afterEach`
- Test both happy path AND error cases
- Integration tests in `tests/integration/`

## E2E Tests (5%)

Golden paths (Playwright):
1. Register → connect Яндекс account → start warmup → verify inbox score updates
2. Create campaign → import CSV → start → verify emails queued in BullMQ
3. Reply received → appears in Unified Inbox → manual reply sent
4. Trial expires → plan downgraded to free → upgrade to Про → campaign unlocked

Rules:
- E2E tests in `tests/e2e/`
- Use real browser (Chromium)
- Never mock SMTP/IMAP in E2E — use test account pool

## BDD Scenarios

70 Gherkin scenarios in `docs/test-scenarios.md`.
Prioritize implementing integration/E2E tests for:
1. US-01/02/03 (Auth + Password Reset) — P0, security-critical
2. US-04 (Email Account + AES encryption) — P0, credential safety
3. US-15 (YooKassa webhook) — P0, payment security
4. 38-ФЗ unsubscribe flow — P0, legal compliance

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
npm run test:perf               # k6 load tests
```

## Never

- **Never mock the database in integration tests** — testcontainers exist for this reason
- Never skip tests to make a deadline — mark as `todo` with a clear ticket
- Never test implementation details — test behavior
- Never store real SMTP/IMAP credentials in test fixtures — use env vars

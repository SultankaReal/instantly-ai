# /test [scope] — Run or Generate Tests

Run or generate tests for a scope.

## Usage

```
/test                   — run all unit tests
/test integration       — run integration tests (requires Docker)
/test e2e               — run E2E tests (requires running app)
/test coverage          — run with coverage report
/test generate [scope]  — generate tests for a service or route
```

## Test Pyramid

```
Unit (70%)       → Vitest, co-located *.test.ts
Integration (25%) → Vitest + testcontainers, tests/integration/
E2E (5%)          → Playwright, tests/e2e/
```

## Commands

```bash
# Unit
npm run test
npm run test:watch
npm run test:coverage

# Integration (requires Docker)
npm run test:integration

# E2E (requires running app)
npm run test:e2e
npm run test:e2e:headed

# Performance
npm run test:perf
```

## Generate Tests

When `/test generate [scope]`:
1. Read the service/route file
2. Read `docs/test-scenarios.md` for relevant Gherkin scenarios
3. Read `docs/Refinement.md` for edge cases
4. Generate Vitest test file with:
   - Happy path tests
   - Error cases from Gherkin scenarios
   - Edge cases from Refinement.md

## Priority Test Files (from validation-report.md)

1. `src/services/auth.service.test.ts` — US-01/02/03 (P0)
2. `src/services/email-account.service.test.ts` — US-04 AES encryption
3. `src/routes/billing/webhook.test.ts` — YooKassa HMAC (P0)
4. `src/services/unsubscribe.service.test.ts` — 38-ФЗ compliance (P0)
5. `src/services/warmup.service.test.ts` — ramp-up logic

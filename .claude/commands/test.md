---
description: Run tests, generate test stubs, or check coverage for Inkflow.
  $ARGUMENTS: scope (unit|integration|e2e|all|coverage) | file path | feature name
---

# /test $ARGUMENTS

## Scope Detection

```
IF $ARGUMENTS is empty OR "all":
    run: npm run test && npm run test:integration

IF $ARGUMENTS == "unit":
    run: npm run test

IF $ARGUMENTS == "integration":
    run: npm run test:integration (requires Docker)

IF $ARGUMENTS == "e2e":
    run: npm run test:e2e (requires running app)

IF $ARGUMENTS == "coverage":
    run: npm run test:coverage
    report threshold: ≥80% line coverage

IF $ARGUMENTS is a file path:
    run: npx vitest run <path>

IF $ARGUMENTS is a feature name:
    find related test files, run them
    suggest missing tests for the feature
```

## Test Generation Mode

If `$ARGUMENTS` is a feature name and tests are missing, generate stubs:

1. Read `docs/test-scenarios.md` for relevant BDD scenarios
2. Read feature implementation files
3. Generate test stubs:
   - Unit tests co-located with source: `src/services/*.test.ts`
   - Integration tests: `tests/integration/*.test.ts`
   - E2E tests: `tests/e2e/*.spec.ts`
4. Commit: `test(<feature>): add test stubs from BDD scenarios`

## Coverage Report

When `coverage` scope:
1. Run `npm run test:coverage`
2. Parse coverage output
3. Report:
```
📊 Coverage Report

Overall: 84% (target: ≥80%) ✅

By package:
  apps/api:      89% ✅
  apps/web:      76% ⚠️ (below 80%)
  apps/worker:   91% ✅
  packages/*:    92% ✅

Low coverage files:
  apps/web/src/components/editor.tsx — 45% (add E2E tests)
  apps/api/src/services/draft.service.ts — 62% (add unit tests)
```

## CI Equivalent

Run the same checks as GitHub Actions CI:
```bash
npm run type-check      # TypeScript strict
npm run lint            # ESLint
npm run test            # Unit tests
npm run test:integration # Integration tests (Testcontainers)
```

## Key Test Scenarios (from docs/test-scenarios.md)

Priority scenarios to implement first:
- US-04: Subscribe → confirm → unsubscribe flow (security-critical token handling)
- US-06: Stripe webhook idempotency (prevent duplicate payment processing)
- US-07: Paywall server-side enforcement (content truncation at 20%)
- US-01: Email send pipeline (BullMQ batch processing)

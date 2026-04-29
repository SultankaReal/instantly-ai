# Coding Style — Поток

Source: `docs/Architecture.md` tech stack decisions.

## TypeScript

- Strict mode: `"strict": true` in all tsconfig files
- No `any` — use `unknown` + type guards where needed
- Explicit return types on all exported functions
- Prefer `type` over `interface` for data shapes; `interface` for extensible contracts
- Use `as const` for enum-like objects instead of TypeScript enums

## Fastify v5 (apps/api)

- Always declare route schemas with Zod → convert to JSON Schema via `zod-to-json-schema`
- Use Fastify plugins for feature grouping (auth, accounts, campaigns, inbox, billing, ai)
- Error handling: use `fastify.setErrorHandler` — never throw unhandled errors
- Async/await throughout — never callbacks
- Return `reply.send()` explicitly on all code paths
- Rate limiting: `@fastify/rate-limit` plugin per route group

## Next.js 15 (apps/web)

- App Router only — no Pages Router patterns
- Server Components by default; add `'use client'` only when needed (event handlers, hooks)
- Data fetching in Server Components via `fetch` with `next: { revalidate: 300 }` for ISR
- Route groups: `(dashboard)` for auth-required, `(public)` for landing/marketing

## Prisma 5 (database)

- Always run `prisma format` before committing schema changes
- Migrations: `prisma migrate dev --name <description>` (never `db push` in production)
- Use `prisma.$transaction()` for multi-step operations (e.g. createAccount + encryptCreds)
- Select only needed fields — avoid `findMany` without explicit `select`

## BullMQ (apps/worker)

- All jobs are idempotent — safe to retry on failure
- Queue names: kebab-case (`warmup-send`, `campaign-send`, `recurring-billing`, `ai-reply`)
- Job data: typed interfaces in `packages/shared-types`
- Max retries: 5 with exponential backoff
- Never block the event loop in job processors

## Email (Nodemailer + imapflow)

- Always decrypt SMTP/IMAP credentials just before use — never cache decrypted creds
- IMAP connections: close after each operation (`client.logout()`)
- Warmup emails: plain text only, vary subjects from template pool
- SMTP: use connection pools for campaign sending (max 5 concurrent per account)

## File Structure

```
apps/api/src/
  plugins/     — Fastify plugins (auth, db, redis, rate-limit)
  routes/      — Route handlers grouped by domain
  services/    — Business logic (stateless, testable)
  schemas/     — Zod schemas (shared with shared-types)

apps/web/src/
  app/         — Next.js App Router pages and layouts
  components/  — React components (ui/, forms/, layout/)
  lib/         — Client utilities, API client
  hooks/       — Custom React hooks

apps/worker/src/
  processors/  — BullMQ job processors (warmup, campaigns, billing, ai-reply)
  queues/      — Queue definitions and job types
  services/    — Shared worker services (email, encryption)

packages/shared-types/src/
  models/      — Database entity types
  api/         — Request/response types
  queue/       — BullMQ job data types
```

## Naming Conventions

- Files: `kebab-case.ts` (e.g., `warmup-send.processor.ts`)
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database tables: `snake_case` (Prisma maps automatically)
- API endpoints: `/api/resource-name` (kebab-case, plural nouns)
- Queue names: `kebab-case` (`warmup-send`, `campaign-send`)

## Error Handling

- Services throw typed errors: `class AccountNotFoundError extends Error`
- Routes catch and convert to HTTP responses
- Never expose internal error details to clients
- Log full stack traces server-side

## Testing Conventions

- Test files: `*.test.ts` co-located with source
- E2E tests: `tests/e2e/*.spec.ts`
- Describe blocks: feature/function name
- Test names: "should [do X] when [condition Y]"
- Use `testcontainers` for integration tests with real PostgreSQL/Redis

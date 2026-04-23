# Coding Style — Inkflow

Source: `docs/Architecture.md` tech stack decisions.

## TypeScript

- Strict mode: `"strict": true` in all tsconfig files
- No `any` — use `unknown` + type guards where needed
- Explicit return types on all exported functions
- Prefer `type` over `interface` for data shapes; `interface` for extensible contracts
- Use `as const` for enum-like objects instead of TypeScript enums

## Fastify (apps/api)

- Always declare route schemas with Zod → convert to JSON Schema via `@asteasolutions/zod-to-openapi`
- Use Fastify plugins for feature grouping (auth, publications, posts, subscribers, payments, ai)
- Error handling: use `fastify.setErrorHandler` — never throw unhandled errors
- Async/await throughout — never callbacks
- Return `reply.send()` explicitly on all code paths

## Next.js 15 (apps/web)

- App Router only — no Pages Router patterns
- Server Components by default; add `'use client'` only when needed (event handlers, hooks)
- Data fetching in Server Components via `fetch` with `next: { revalidate: 300 }` for ISR
- `generateMetadata()` for SEO — every public page must export this function
- Route groups: `(dashboard)` for auth-required, `(public)` for public pages

## Prisma (database)

- Always run `prisma format` before committing schema changes
- Migrations: `prisma migrate dev --name <description>` (never `db push` in production)
- Use `prisma.$transaction()` for multi-step operations
- Select only needed fields — avoid `findMany` without explicit `select`

## BullMQ (apps/worker)

- All jobs are idempotent — safe to retry on failure
- Queue names: kebab-case (`email-send`, `import-subscribers`)
- Job data: typed interfaces in `packages/shared-types`
- Max retries: 5 with exponential backoff (configured in queue options)

## File Structure

```
apps/api/src/
  plugins/     — Fastify plugins (auth, db, redis, rate-limit)
  routes/      — Route handlers grouped by domain
  services/    — Business logic (stateless, testable)
  schemas/     — Zod schemas (shared with shared-types)
  workers/     — BullMQ worker definitions

apps/web/src/
  app/         — Next.js App Router pages and layouts
  components/  — React components (ui/, forms/, layout/)
  lib/         — Client utilities, API client
  hooks/       — Custom React hooks

packages/shared-types/src/
  models/      — Database entity types
  api/         — Request/response types
  queue/       — BullMQ job data types
```

## Naming Conventions

- Files: `kebab-case.ts` (e.g., `send-post.service.ts`)
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Database tables: `snake_case` (Prisma maps automatically)
- API endpoints: `/api/resource-name` (kebab-case, plural nouns)

## Error Handling

- Services throw typed errors: `class PostNotFoundError extends Error`
- Routes catch and convert to HTTP responses
- Never expose internal error details to clients
- Log full stack traces server-side (Sentry in production)

## Testing Conventions

- Test files: `*.test.ts` co-located with source
- E2E tests: `tests/e2e/*.spec.ts`
- Describe blocks: feature/function name
- Test names: "should [do X] when [condition Y]"
- Use `testcontainers` for integration tests with real PostgreSQL/Redis

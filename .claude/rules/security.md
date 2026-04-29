# Security Rules — Поток

Source: `docs/Specification.md` NFRs + `docs/Architecture.md` Security Architecture.

## Authentication & Sessions

- JWT HS256 — access token TTL: **15 minutes**, refresh token TTL: **7 days**
- Refresh tokens stored in Redis (`refresh:{userId}:{token}` key)
- Blacklist on logout: `redis.del(`refresh:{userId}:{token}`)` 
- Never extend access token TTL beyond 15 minutes
- `Authorization: Bearer <token>` header only — never cookies for API

## Password Security

- bcrypt cost factor **12** — never lower
- Never store plaintext passwords; never log passwords or tokens
- Password reset: time-limited single-use token (1h TTL), HMAC-signed, single-use via Redis del

## Email Credential Encryption

- All SMTP/IMAP credentials: AES-256-GCM encrypted BYTEA in PostgreSQL
- Encryption key from `ENCRYPTION_KEY` env var — never hardcode
- Decrypt only in worker process at send time — never return credentials in API response
- Never log decrypted credentials

## Rate Limiting

- Anonymous endpoints: **100 req/min** per IP (Redis sliding window)
- Authenticated endpoints: **1000 req/min** per user
- AI generation (`/api/ai/generate-draft`): **10 req/hr** per user
- Password reset: **3 req/hr** per email (silent limit — always return 200)
- Implement at API layer (fastify-rate-limit plugin)

## Input Validation

- **All API boundaries**: Zod schemas — never trust raw `req.body`
- **HTML content**: DOMPurify on ALL user-generated HTML before DB write AND before render
- **Email format**: validate at subscription and account creation endpoints
- **File size**: reject imports > 10MB before parsing

## Webhook Security

- **YooKassa**: `crypto.timingSafeEqual(computedHmac, receivedHmac)` — never skip
- Idempotency: `yookassa_event_id` UNIQUE constraint prevents double-processing
- Always use raw `Buffer` body for HMAC verification (not parsed JSON)
- Invalid signature → 401, log security event, never process

## SQL & Data Access

- Prisma ORM only — zero string concatenation in queries
- Multi-tenant isolation: every query must include `userId` filter
- Never trust client-provided resource IDs alone — verify ownership in DB
- 404 (not 403) for cross-tenant access — don't reveal resource existence

## 38-ФЗ Compliance

- Every campaign email MUST have server-side appended unsubscribe link
- Unsubscribe token: HMAC-SHA256 signed, verified server-side (no auth required)
- One-click unsubscribe: GET /unsubscribe?token=... → 200 "Вы отписаны"
- Unsubscribes table: `UNIQUE(email)` — idempotent
- getPendingSends: always exclude unsubscribes table before creating BullMQ jobs

## Secret Management

- All secrets via environment variables only
- Docker Compose uses `${VAR}` pattern — never hardcode
- API keys for external services: never log, never return in API responses
- `.env` files: always in `.gitignore`

## CORS

- API: allow only `NEXT_PUBLIC_APP_URL` origin + `*.поток.ru`
- Do not use `cors({ origin: '*' })` in production

## Known Security Caveats

| Gap | Required Before |
|-----|----------------|
| YooKassa webhook Gherkin AC | Production payments |
| Per-provider inbox score breakdown | v1.0 release |
| AI Reply feature flag (`ai_reply_enabled`) | v1.0 rollout |

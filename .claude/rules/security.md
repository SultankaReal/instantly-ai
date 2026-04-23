# Security Rules — Inkflow

Source: `docs/Specification.md` NFRs + `docs/Architecture.md` security architecture.

## Authentication & Sessions

- JWT HS256 — access token TTL: 15 minutes, refresh token TTL: 7 days
- Refresh tokens stored in Redis with blacklist for logout/revocation
- Never extend access token TTL beyond 15 minutes
- `Authorization: Bearer <token>` header — never cookies for API

## Password Security

- bcrypt cost factor **12** — never lower
- Never store plaintext passwords; never log passwords or tokens
- Password reset: time-limited single-use tokens (1h), HMAC-signed

## Rate Limiting

- Anonymous endpoints: **100 req/min** per IP (Redis sliding window)
- Authenticated endpoints: **1000 req/min** per user
- AI generation (`/api/ai/generate-draft`): **10 req/hr** per author
- Implement at Nginx + API layer (double guard)

## Input Validation

- **All API boundaries**: Zod schemas — never trust raw `req.body`
- **HTML content**: DOMPurify on ALL user-generated HTML before DB write AND before render
- **Email addresses**: validate format + domain at subscription endpoint
- **File uploads (Substack import)**: max 50MB, ZIP only, check magic bytes

## Webhook Security

- **Stripe**: `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` — never skip signature
- **Postmark**: verify `X-Postmark-Signature` shared-secret header before processing events
- Always use raw `Buffer` body for webhook signature verification (not parsed JSON)

## SQL & Data Access

- Prisma ORM only — zero string concatenation in queries
- Multi-tenant isolation: every query filters by `publication_id` (never trust user-provided IDs alone)
- Verify `authorId` ownership before any post mutation (`sendPost`, `updatePost`)

## Secret Management

- All secrets via environment variables only
- Docker Compose uses `${VAR}` pattern — never hardcode
- API keys for external services: never log, never return in API responses
- `.env` files: `.gitignore` always includes `.env`, `.env.local`, `.env.*.local`

## CORS

- API: allow only `NEXT_PUBLIC_APP_URL` origin + `*.inkflow.io`
- Do not use `cors({ origin: '*' })` in production

## Content Security

- Stripe metadata: validate `publication_id` ownership server-side in checkout handler
- Paywall: enforce content truncation **server-side** in `getPostContent()` — never rely on frontend overlay alone
- Confirmation tokens: single-use, invalidated immediately after click

## GDPR — Critical Gap (pre-launch blocker for EU)

⚠️ GDPR data flows are NOT designed. Before acquiring EU users:
1. Add `consent_log` table (event, timestamp, ip, user_agent)
2. Implement `DELETE /api/users/me` (deletion within 24h)
3. Implement `GET /api/users/me/export` (data export on request)

## Known Security Caveats (from validation-report.md)

| Gap | Required Before |
|-----|----------------|
| GDPR consent_log + deletion/export endpoints | EU user acquisition |
| Stripe webhook event deduplication (stripe_event_id) | Production payments |
| ZIP bomb protection in Substack import | Enabling import in production |
| Confirmation token `expires_at` column migration | Subscribe flow launch |

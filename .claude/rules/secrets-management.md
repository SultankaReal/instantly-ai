# Secrets Management — Inkflow

Inkflow integrates with multiple external APIs (Stripe, Postmark, Claude API, Resend, CloudPayments).
This rule governs how secrets are handled.

## Principle

**Secrets live in environment variables only.** Never in code, never in git, never in API responses.

## Environment Variable Pattern

All secrets use `${VAR_NAME}` in docker-compose.yml:

```yaml
environment:
  JWT_SECRET: ${JWT_SECRET}
  STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
  STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET}
  POSTMARK_API_TOKEN: ${POSTMARK_API_TOKEN}
  RESEND_API_KEY: ${RESEND_API_KEY}
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
  CLOUDPAYMENTS_PUBLIC_ID: ${CLOUDPAYMENTS_PUBLIC_ID}
  CLOUDPAYMENTS_API_SECRET: ${CLOUDPAYMENTS_API_SECRET}
  DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
  REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
  MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
  MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
```

## Never Do

- Never hardcode API keys or passwords in source files
- Never commit `.env` files (`.gitignore` must include `.env`, `.env.*`)
- Never log secrets (check middleware for accidental `console.log(req.headers)`)
- Never return secrets in API responses (even partial)
- Never store secrets in frontend code (process.env.NEXT_PUBLIC_* is client-visible)

## .env.example

Always maintain `.env.example` with placeholder values:
```bash
# Authentication
JWT_SECRET=your-256-bit-secret-here
JWT_REFRESH_SECRET=another-256-bit-secret

# Database
POSTGRES_USER=inkflow
POSTGRES_PASSWORD=change-me-in-production
POSTGRES_DB=inkflow

# Redis
REDIS_PASSWORD=change-me-in-production

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Postmark
POSTMARK_API_TOKEN=your-postmark-token
POSTMARK_WEBHOOK_SECRET=your-webhook-secret

# Resend (fallback email)
RESEND_API_KEY=re_...

# AI
ANTHROPIC_API_KEY=sk-ant-...

# CloudPayments (RU)
CLOUDPAYMENTS_PUBLIC_ID=pk_...
CLOUDPAYMENTS_API_SECRET=your-api-secret

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=change-me-in-production
```

## Production Secrets Rotation

- Rotate JWT_SECRET quarterly (requires user re-login)
- Rotate webhook secrets if a breach is suspected
- Stripe: use separate keys for test/staging/production environments

## API Keys (Publication-Level)

Future feature: Inkflow API keys for public API (v2.0).
Implementation: hash with SHA-256, store `key_hash` only — never store plaintext key.
Return plaintext ONCE on creation, never again.

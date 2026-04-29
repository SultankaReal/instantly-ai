# Secrets Management — Поток

Поток integrates with YooKassa, Claude API (Anthropic), Яндекс/Mail.ru SMTP/IMAP.
This rule governs how secrets are handled.

## Principle

**Secrets live in environment variables only.** Never in code, never in git, never in API responses.

## Environment Variable Pattern

All secrets use `${VAR_NAME}` in docker-compose.yml:

```yaml
environment:
  JWT_SECRET: ${JWT_SECRET}
  JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
  ENCRYPTION_KEY: ${ENCRYPTION_KEY}
  YOOKASSA_SHOP_ID: ${YOOKASSA_SHOP_ID}
  YOOKASSA_SECRET_KEY: ${YOOKASSA_SECRET_KEY}
  YOOKASSA_WEBHOOK_SECRET: ${YOOKASSA_WEBHOOK_SECRET}
  ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
  DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
  REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
  MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
  MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
```

## Special: Email Credential Encryption

- SMTP/IMAP credentials are stored encrypted in the database (AES-256-GCM)
- `ENCRYPTION_KEY` must be 32-byte hex (256-bit) — generate with `openssl rand -hex 32`
- The key must be identical across api and worker containers
- Rotate: create new encrypted copy of all credentials before changing the key

## Never Do

- Never hardcode API keys or passwords in source files
- Never commit `.env` files (`.gitignore` must include `.env`, `.env.*`)
- Never log secrets (check middleware for accidental `console.log(req.headers)`)
- Never return secrets in API responses
- Never store ENCRYPTION_KEY in `.env.example` — only document the format

## .env.example

```bash
# Authentication
JWT_SECRET=generate-256-bit-secret-here
JWT_REFRESH_SECRET=generate-another-256-bit-secret

# Database
POSTGRES_USER=potok
POSTGRES_PASSWORD=change-me-in-production
POSTGRES_DB=potok

# Redis
REDIS_PASSWORD=change-me-in-production

# Email credential encryption
ENCRYPTION_KEY=generate-with-openssl-rand-hex-32

# YooKassa
YOOKASSA_SHOP_ID=your-shop-id
YOOKASSA_SECRET_KEY=your-secret-key
YOOKASSA_WEBHOOK_SECRET=your-webhook-secret

# AI
ANTHROPIC_API_KEY=sk-ant-...

# MinIO
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=change-me-in-production

# App
NEXT_PUBLIC_APP_URL=https://поток.ru
```

## Production Secrets Rotation

- Rotate `JWT_SECRET` quarterly (requires user re-login)
- Rotate `YOOKASSA_WEBHOOK_SECRET` if a breach is suspected
- Rotate `ENCRYPTION_KEY`: decrypt all credentials → generate new key → re-encrypt → deploy

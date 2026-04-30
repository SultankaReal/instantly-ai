# Completion: Subscriber Management
**Feature:** F2 | **Date:** 2026-05-01

---

## Pre-Deployment Checklist

- [ ] `UNSUBSCRIBE_TOKEN_SECRET` env var set (min 32 chars) in production
- [ ] `POSTMARK_FROM_EMAIL` env var set to a verified sender address
- [ ] `NEXT_PUBLIC_APP_URL` set correctly for confirmation link generation
- [ ] Worker process updated to register `email-confirmation.worker.ts`
- [ ] Prisma migration check: `confirmation_token_expires_at` column exists (it does — in init migration)
- [ ] All unit and integration tests passing
- [ ] Postmark account in production mode (not sandbox)

## Deployment Sequence

1. Deploy API — `POST /api/publications/:pubId/subscribers` is backwards-compatible
2. Deploy worker with new confirmation worker registered
3. Deploy web with new public pages (`/p/[slug]`, `/confirm`, `/unsubscribe`)
4. Smoke test: subscribe with test email → confirm confirmation arrives → click link → verify active status

## Rollback Procedure

1. Revert worker to previous image — confirmation jobs stay in queue
2. Revert web to previous image — subscribe form disappears from public pages
3. Subscribers in `pending_confirmation` state are harmless (they haven't confirmed)

---

## Monitoring & Alerting

| Metric | Threshold | Action |
|--------|-----------|--------|
| BullMQ `email-send` queue depth | > 1000 | Alert — worker may be down |
| `send-confirmation` job failures | > 5 in 15 min | Alert — Postmark issue |
| Subscriber confirm rate | < 20% over 48h | Investigate email deliverability |
| Unsubscribe endpoint errors | > 1% | Alert — token generation bug |

## Key Env Vars

```bash
UNSUBSCRIBE_TOKEN_SECRET=<32+ chars random string>
POSTMARK_FROM_EMAIL=hello@yourdomain.com
POSTMARK_API_TOKEN=<postmark server token>
NEXT_PUBLIC_APP_URL=https://inkflow.io
REDIS_URL=redis://:password@redis:6379
DATABASE_URL=postgresql://...
```

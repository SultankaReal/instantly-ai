# Completion — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## 1. Deployment Checklist

### Pre-Deploy

- [ ] `POSTMARK_API_TOKEN` set in environment (required by worker)
- [ ] `POSTMARK_FROM_EMAIL` set in environment (defaults to `noreply@inkflow.io`)
- [ ] `POSTMARK_WEBHOOK_SECRET` set for bounce/delivery event webhook processing
- [ ] Redis accessible from both API and Worker containers
- [ ] `prisma migrate deploy` run against production PostgreSQL
- [ ] `UNIQUE (publication_id, slug)` index confirmed present in schema
- [ ] Queue singleton plugin registered before post routes in Fastify startup
- [ ] `BATCH_SIZE` set to 500 (aligned with Postmark API limit) — change from current 1000
- [ ] `NODE_ENV=production` set in all containers

### Smoke Tests (post-deploy)

- [ ] `GET /healthz` returns 200 from API container
- [ ] Create a draft post via `POST /api/publications/:pubId/posts`
- [ ] Retrieve the draft via `GET /api/posts/:id` (as author)
- [ ] Send the post to a test subscriber list via `POST /api/posts/:id/send`
- [ ] Verify EmailSend records created in PostgreSQL
- [ ] Verify BullMQ job appears in bull-board dashboard
- [ ] Verify email delivered to test inbox
- [ ] Access the post via public URL `GET /api/publications/:pubId/posts/:postSlug` (no auth)
- [ ] Verify paywall truncation for paid post as anonymous user

---

## 2. Required Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `POSTMARK_API_TOKEN` | worker | Postmark server API token — required for email delivery |
| `POSTMARK_FROM_EMAIL` | worker | Sender email address (must be verified in Postmark) |
| `POSTMARK_WEBHOOK_SECRET` | api | Shared secret for `X-Postmark-Signature` header verification |
| `REDIS_URL` | api, worker | Redis connection string for BullMQ queue |
| `DATABASE_URL` | api, worker | PostgreSQL connection string for Prisma |
| `JWT_SECRET` | api | HS256 signing secret for access tokens |

---

## 3. Monitoring

### Key Metrics to Watch

#### Email Delivery Health
```sql
-- EmailSend status distribution (run hourly)
SELECT status, COUNT(*) as count
FROM email_sends
WHERE queued_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```
Alert if `bounced / (sent + bounced) > 5%` — Postmark may suspend the account.

#### Queue Depth
Monitor via bull-board at `http://api:3000/admin/bull-board` (internal only).
Alert if queue depth on `email:send-batch` exceeds 50 jobs for more than 10 minutes — indicates worker is down or overwhelmed.

#### Bounce Rate Alert
Configure in Grafana:
```
Rate: email_sends_bounced_total / email_sends_sent_total > 0.05
Severity: warning
```

#### Worker Health
Monitor `apps/worker` container restart count. Worker exits if `POSTMARK_API_TOKEN` is missing (throws on startup). Container restart = token missing or config error.

### Structured Log Fields (worker)
The worker emits structured JSON logs with fields:
- `worker: "email-send"`
- `jobId`, `postId`, `publicationId`
- `processed`, `sent`, `failed` counts per batch

Use these for Grafana/Loki dashboards.

---

## 4. Rollback Strategy

### If Worker Crashes Mid-Send
- BullMQ jobs persist in Redis. No data is lost.
- Jobs in `active` state at crash time become `stalled` after `stalledInterval` (default: 30s).
- BullMQ automatically moves stalled jobs back to `waiting` for retry.
- Worker restart recovers automatically — no manual intervention needed.
- Maximum job retry: 5 attempts with exponential backoff (2s → 32s).

### If API Crashes During Send Request
- `POST /api/posts/:id/send` may have partially created EmailSend records without enqueuing jobs.
- On recovery: EmailSend records exist with `status = 'queued'` but no corresponding BullMQ job.
- Manual recovery: query `EmailSend` for records with `status = 'queued'` and `queued_at < 10min ago`, re-enqueue via admin tooling.
- Prevent with database transaction (future improvement): wrap `emailSend.createMany()` + queue `add()` in a saga pattern.

### If Postmark Is Down
- Worker job fails. BullMQ retries up to 5 times with exponential backoff.
- If all 5 retries fail, job moves to `failed` state in Redis.
- Failed jobs are retained for 200 entries (`removeOnFail: 200`).
- Recovery: fix Postmark issue, then use bull-board to retry failed jobs.

### Feature Rollback (code revert)
- If the new `GET /api/publications/:pubId/posts/:postSlug` endpoint causes issues, reverting `apps/api/src/routes/posts.ts` restores the previous state.
- The Next.js public post page (`[slug]/posts/[postSlug]/page.tsx`) will return 404 for all posts until the endpoint is re-deployed (same as the current broken state).
- Queue singleton plugin revert: removing `emailQueuePlugin` and reverting to per-request `new Queue()` restores the previous behavior (with the known resource leak).

---

## 5. Database Migration Checklist

No new Prisma migrations are required for the publishing gap fixes. All columns referenced (`published_at`, `scheduled_at`, `meta_description`, `slug`) already exist in the schema.

If `published_at` needs backfilling for existing sent posts:
```sql
UPDATE posts
SET published_at = sent_at
WHERE status = 'sent'
AND published_at IS NULL
AND sent_at IS NOT NULL;
```
Run as a one-off script before deploying the public post page fix.

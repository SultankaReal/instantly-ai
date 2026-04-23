# Completion: Inkflow
**Дата:** 2026-04-23 | **Scope:** Deployment Plan, CI/CD, Monitoring, Handoff Checklists

---

## 1. Pre-Deployment Checklist

### Infrastructure
- [ ] VPS provisioned (AdminVPS/HOSTKEY, Ubuntu 22.04 LTS, min 4 vCPU / 8GB RAM / 100GB SSD)
- [ ] Docker 24+ and Docker Compose v2 installed on VPS
- [ ] Domain `inkflow.io` DNS configured at Cloudflare
- [ ] Wildcard cert `*.inkflow.io` issued (Let's Encrypt via certbot)
- [ ] Firewall: only ports 80, 443, 22 open externally
- [ ] SSH key-based auth only (password auth disabled)
- [ ] Swap: 4GB swap file configured (protection against OOM)

### Services & Secrets
- [ ] Postmark account: verified sending domain, DKIM/SPF/DMARC configured
- [ ] Stripe account: non-RU legal entity (Cyprus/UAE); webhook endpoint registered
- [ ] CloudPayments account: webhook endpoint registered
- [ ] Claude API key provisioned (Anthropic Console)
- [ ] `.env.production` created on VPS (never committed to git)
- [ ] All secrets rotated post-staging: JWT_SECRET, PG_PASSWORD, REDIS_PASSWORD
- [ ] MinIO initial bucket `inkflow-uploads` created with versioning enabled

### Application
- [ ] `prisma migrate deploy` run successfully on production DB
- [ ] `GET /api/health` returns 200 on all services
- [ ] Postmark test email sent and received
- [ ] Stripe test webhook fires and DB updates subscriber tier
- [ ] Sentry DSN configured and test error captured
- [ ] Prometheus scrape targets showing all services
- [ ] Grafana dashboards imported (api-latency, email-queue, subscriber-growth)

### Legal & Compliance
- [ ] Privacy Policy published at `/legal/privacy`
- [ ] Terms of Service published at `/legal/terms`
- [ ] GDPR consent text reviewed by legal
- [ ] Data Processing Agreement (DPA) template prepared for authors
- [ ] Cookie consent banner implemented

---

## 2. Deployment Plan

### 2.1 Initial Deploy (Week 3)

```bash
# On VPS as deploy user
git clone https://github.com/inkflow/inkflow.git /opt/inkflow
cd /opt/inkflow

# Copy secrets
cp /root/.env.production .env

# Build images
docker compose build --no-cache

# Start infrastructure first
docker compose up -d postgres redis minio

# Wait for DB ready
docker compose exec postgres pg_isready -U inkflow

# Run migrations
docker compose run --rm api npx prisma migrate deploy

# Start all services
docker compose up -d

# Verify
docker compose ps
curl -sf https://api.inkflow.io/api/health | jq .
```

### 2.2 Zero-Downtime Deploy (Rolling Updates)

```bash
#!/bin/bash
# scripts/deploy.sh

set -euo pipefail

SERVICE=${1:-api}
echo "Deploying $SERVICE..."

# Pull latest code
git pull origin main

# Build new image
docker compose build $SERVICE

# Scale up new (2 replicas briefly)
docker compose up -d --scale $SERVICE=2 --no-recreate

# Wait for new container healthy
sleep 15

# Scale down to 1 (removes old)
docker compose up -d --scale $SERVICE=1

echo "✅ $SERVICE deployed"
```

### 2.3 Rollback Procedure

```bash
# Fast rollback: restart from previous image
docker compose stop api
docker tag inkflow-api:previous inkflow-api:latest
docker compose up -d api

# If DB migration rolled forward: restore from backup
docker compose exec postgres pg_restore \
  -U inkflow -d inkflow /backups/inkflow_$(date +%Y%m%d).dump
```

---

## 3. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Build, Test, Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: inkflow
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: inkflow_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: --health-cmd "redis-cli ping"

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm run typecheck

      - name: Lint
        run: pnpm run lint

      - name: Unit tests
        run: pnpm run test:unit

      - name: Integration tests
        run: pnpm run test:integration
        env:
          DATABASE_URL: postgresql://inkflow:test_password@localhost:5432/inkflow_test
          REDIS_URL: redis://localhost:6379

      - name: Build
        run: pnpm run build

  lighthouse:
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v11
        with:
          urls: |
            https://staging.inkflow.io
          budgetPath: ./lighthouse-budget.json
          temporaryPublicStorage: true

  deploy:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/inkflow
            git pull origin main
            docker compose build api web worker
            docker compose up -d
            docker compose exec api npx prisma migrate deploy
            curl -sf http://localhost:3001/api/health

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1.26.0
        with:
          payload: '{"text":"🔴 Deploy failed: ${{ github.sha }}"}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Lighthouse Budget (`lighthouse-budget.json`)

```json
[
  {
    "path": "/*/posts/*",
    "timings": [
      { "metric": "largest-contentful-paint", "budget": 1500 },
      { "metric": "total-blocking-time", "budget": 200 },
      { "metric": "first-contentful-paint", "budget": 800 }
    ],
    "resourceSizes": [
      { "resourceType": "script", "budget": 300 },
      { "resourceType": "image", "budget": 500 }
    ]
  }
]
```

---

## 4. Monitoring & Alerting

### 4.1 Prometheus Alert Rules

```yaml
# monitoring/alerts.yml
groups:
  - name: inkflow-critical
    rules:
      - alert: APIHighLatency
        expr: histogram_quantile(0.99, http_request_duration_seconds_bucket) > 0.2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API p99 latency above 200ms"

      - alert: EmailQueueDepthHigh
        expr: email_send_queue_depth > 10000
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Email queue depth {{ $value }} — workers may be stalled"

      - alert: EmailDeliveryFailureHigh
        expr: rate(email_delivery_failure_total[5m]) / rate(email_delivery_success_total[5m]) > 0.02
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Email failure rate above 2%"

      - alert: DatabaseDown
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "PostgreSQL is unreachable"

      - alert: WorkerDown
        expr: up{job="worker"} == 0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Email worker is down — no emails will be sent"

      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disk space below 10% on {{ $labels.mountpoint }}"
```

### 4.2 Grafana Dashboard Panels

**Dashboard: API Performance**
- Request rate (req/s) by endpoint
- p50/p95/p99 latency histogram
- Error rate (4xx/5xx) by endpoint
- Active connections

**Dashboard: Email Pipeline**
- Jobs enqueued per hour
- Jobs completed vs failed
- Queue depth over time
- Delivery success rate (Postmark)
- Open rate / click rate by post (24h window)

**Dashboard: Business Metrics**
- Total subscribers (free/paid/trial)
- New subscribers per day (30-day trend)
- Revenue (MRR, new MRR, churned MRR)
- Active authors count

**Dashboard: Infrastructure**
- CPU/Memory/Disk per service
- PostgreSQL connection pool utilization
- Redis memory usage + hit rate
- MinIO storage utilization

### 4.3 Uptime Monitoring

**Uptime Robot checks:**

| URL | Interval | Alert |
|-----|---------|-------|
| `https://inkflow.io` | 1 min | Email + SMS |
| `https://api.inkflow.io/api/health` | 1 min | Email + SMS |
| `https://inkflow.io/[test-slug]` | 5 min | Email |

**SLA target:** 99.5% uptime = max 3.65 hours/month downtime

---

## 5. Backup Strategy

### 5.1 PostgreSQL Backups

```bash
# scripts/backup.sh — runs via cron: 0 2 * * *
#!/bin/bash
set -euo pipefail

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups"
RETENTION_DAYS=7

# Full dump
docker compose exec -T postgres pg_dump \
  -U inkflow inkflow \
  --format=custom \
  > "$BACKUP_DIR/inkflow_$DATE.dump"

# Upload to MinIO (off-site copy)
docker compose exec -T minio \
  mc cp "$BACKUP_DIR/inkflow_$DATE.dump" minio/inkflow-backups/

# Prune old backups
find "$BACKUP_DIR" -name "*.dump" -mtime +$RETENTION_DAYS -delete

echo "✅ Backup complete: inkflow_$DATE.dump"
```

**Backup schedule:**
- Full dump: Daily at 2:00 AM
- Retention: 7 days local + 30 days in MinIO
- Test restore: Weekly (automated, to staging environment)

### 5.2 Recovery Time Objectives

| Scenario | RTO | RPO | Procedure |
|----------|-----|-----|-----------|
| Service crash | < 2 min | 0 | Docker restart (auto) |
| VPS reboot | < 5 min | 0 | Docker Compose auto-start |
| DB corruption | < 30 min | < 24h | Restore from daily backup |
| Full VPS failure | < 2h | < 24h | Provision new VPS + restore |

---

## 6. Database Migration Strategy

### Migration Rules
1. **Always backwards-compatible** — new nullable column before removing old
2. **Never break the index at scale** — create indexes `CONCURRENTLY` in prod
3. **Zero-downtime migrations** — API handles both old and new schema during deploy

```bash
# Development: generate migration
npx prisma migrate dev --name "add-subscriber-source"

# Production: apply migration
npx prisma migrate deploy

# Rollback: restore from backup (no automated down-migration)
```

### Migration Checklist (before each release)
- [ ] New columns are nullable OR have default values
- [ ] No column drops without 1-release deprecation cycle
- [ ] Large table index changes use `CREATE INDEX CONCURRENTLY`
- [ ] Migration tested on staging with production-size data snapshot

---

## 7. Environment Configuration

### Environment Variables Reference

```bash
# === DATABASE ===
DATABASE_URL=postgresql://inkflow:PASSWORD@postgres:5432/inkflow
PG_PASSWORD=                          # Generated: openssl rand -hex 32

# === REDIS ===
REDIS_URL=redis://:PASSWORD@redis:6379
REDIS_PASSWORD=                       # Generated: openssl rand -hex 32

# === AUTH ===
JWT_SECRET=                           # Generated: openssl rand -hex 64
JWT_REFRESH_SECRET=                   # Generated: openssl rand -hex 64

# === EMAIL ===
POSTMARK_API_KEY=                     # From Postmark account
POSTMARK_WEBHOOK_TOKEN=               # Generated, set in Postmark dashboard
RESEND_API_KEY=                       # Fallback email provider

# === PAYMENTS ===
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...       # From Stripe webhook settings
CLOUDPAYMENTS_PUBLIC_ID=             # From CloudPayments account
CLOUDPAYMENTS_API_SECRET=

# === AI ===
CLAUDE_API_KEY=sk-ant-...             # From Anthropic Console
CLAUDE_MODEL=claude-sonnet-4-6

# === STORAGE ===
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_ACCESS_KEY=                     # Generated: openssl rand -hex 16
MINIO_SECRET_KEY=                     # Generated: openssl rand -hex 32
MINIO_BUCKET=inkflow-uploads

# === APP ===
NODE_ENV=production
PUBLIC_URL=https://inkflow.io
PORT=3001
LOG_LEVEL=info

# === MONITORING ===
SENTRY_DSN=                           # From Sentry project settings
GRAFANA_PASSWORD=                     # Change after first login
```

---

## 8. Feature Flags

Feature flags in Redis allow safe rollout without code deploy:

```typescript
// Usage in code
const flags = await redis.hgetall('feature_flags')
if (flags.ai_writing_assistant === 'true') {
  // Show AI features
}
```

| Flag | Default | Description |
|------|---------|-------------|
| `ai_writing_assistant` | false | Enable AI draft generation (v1.0) |
| `paid_subscriptions` | true | Enable Stripe checkout |
| `cloudpayments` | false | Enable CloudPayments (RU) |
| `substack_import` | true | Enable Substack ZIP import |
| `recommendations` | false | Cross-publication recommendations (v1.0) |
| `analytics_realtime` | false | Real-time analytics dashboard (v1.0) |

**Toggle via CLI:**
```bash
docker compose exec redis redis-cli HSET feature_flags ai_writing_assistant true
```

---

## 9. Incident Response Playbook

### Severity Levels

| Sev | Description | Response Time | Escalation |
|-----|------------|--------------|------------|
| P0 | Production down (site unreachable) | 15 min | All hands |
| P1 | Email delivery failing (> 5% failure) | 30 min | On-call dev |
| P2 | Payments failing | 30 min | On-call dev |
| P3 | Feature degraded (AI, import, etc.) | 2h | Next business day |

### P0 Runbook: Site Down

```
1. Check Uptime Robot alert → confirm outage
2. SSH to VPS: docker compose ps → identify failed service
3. Check logs: docker compose logs --tail=100 nginx
4. Common causes:
   a) Nginx cert expired → certbot renew
   b) OOM → restart container + check memory
   c) Disk full → clean old images: docker system prune
5. If DB down: restore from backup (see §5.2)
6. Post incident report in Slack #incidents within 24h
```

---

## 10. Launch Checklist

### Week 3 (MVP Launch)
- [ ] All automated tests passing (unit + integration)
- [ ] Lighthouse score: LCP < 1.5s on `/[slug]/posts/[id]`
- [ ] Send test email to 10 internal team subscribers
- [ ] Stripe test payment completes, subscriber tier updates
- [ ] Postmark DMARC report shows 0 failures
- [ ] Error rate in Sentry: 0 P0/P1 errors in 24h staging soak
- [ ] Backup restore tested successfully
- [ ] Security headers verified (securityheaders.com scan: A grade)
- [ ] GDPR consent flow reviewed

### Month 2 (Beta Users)
- [ ] Onboard 5 beta authors
- [ ] Email delivery rate ≥ 98% (Postmark dashboard)
- [ ] API p99 < 200ms under real load
- [ ] Support workflow established (email/Telegram)
- [ ] First subscriber import from Substack tested with real data

### Month 3 (PMF Gate)
- [ ] Sean Ellis survey sent to 40+ active authors
- [ ] "Very disappointed" ≥ 40% → proceed to v1.0
- [ ] NPS ≥ 50 from paying users
- [ ] D30 retention (paying) ≥ 70%

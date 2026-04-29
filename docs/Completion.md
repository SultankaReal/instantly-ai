# Completion: Поток

**Дата:** 2026-04-29 | Последний документ SPARC Phase 1

---

## Содержание

1. [Pre-Launch Checklist](#1-pre-launch-checklist)
2. [Initial Deployment Runbook](#2-initial-deployment-runbook)
3. [CI/CD Pipeline](#3-cicd-pipeline)
4. [Monitoring & Alerting](#4-monitoring--alerting)
5. [Rollback Strategy](#5-rollback-strategy)
6. [Operational Runbooks](#6-operational-runbooks)
7. [Launch Plan](#7-launch-plan)

---

## 1. Pre-Launch Checklist

### Infrastructure

```
✗ VPS provisioned (AdminVPS/HOSTKEY: 4 CPU / 8GB RAM / 100GB SSD)
✗ Ubuntu 22.04 LTS installed, SSH key-only access (port 2222)
✗ UFW configured: allow 80, 443, 2222. Block all else.
✗ Docker + Docker Compose installed
✗ Domain app.поток.ru → VPS IP via Cloudflare DNS
✗ TLS certificate issued via Certbot (Let's Encrypt)
✗ 100 seed Yandex accounts created with App Passwords
✗ YooKassa shop registered, test payments verified
✗ Anthropic API key purchased, EU proxy configured
```

### Application

```
✗ All SPARC docs reviewed and consistent
✗ docker-compose.yml with all services
✗ .env.example with all required variables
✗ Prisma migrations tested on clean DB
✗ All unit tests pass (≥ 80% coverage)
✗ Integration tests pass with testcontainers
✗ Seed warmup pool script ready (scripts/seed-warmup-pool.ts)
✗ DOMPurify sanitization verified on campaign HTML
✗ Unsubscribe flow tested end-to-end
✗ YooKassa webhook verified in sandbox
✗ Rate limiting tested (100/min anon, 1000/min auth)
```

### Security

```
✗ bcrypt cost 12 verified in production build
✗ JWT secrets are 256-bit random (openssl rand -base64 32)
✗ ENCRYPTION_KEY is 32-byte random
✗ No secrets committed to git (git log --all | grep -i "secret\|password\|key")
✗ Nginx HSTS + X-Frame-Options headers in place
✗ Cloudflare: WAF rules enabled, bot protection on
✗ PostgreSQL: no public internet access (Docker internal only)
✗ Redis: password-protected, no public access
✗ YooKassa webhook IP whitelist configured
```

### Legal & Compliance

```
✗ ToS published (запрет массового спама, 38-ФЗ условия)
✗ Privacy Policy published (152-ФЗ)
✗ Unsubscribe link present in all email templates
✗ VPS server physically located in Russia (152-ФЗ data residency)
✗ DMARC check enabled in onboarding (блокировка без DMARC — предупреждение)
```

---

## 2. Initial Deployment Runbook

### Step 1: Server Setup

```bash
# Connect to VPS
ssh -p 2222 deploy@<VPS_IP>

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy

# Install Docker Compose
apt-get install docker-compose-plugin

# Verify
docker --version && docker compose version
```

### Step 2: Clone & Configure

```bash
# Clone repository
git clone git@github.com:SultankaReal/instantly-ai.git /opt/potok
cd /opt/potok

# Copy and fill environment
cp .env.example .env
nano .env  # Fill all required values

# Required .env values:
# NODE_ENV=production
# APP_URL=https://app.поток.ru
# JWT_SECRET=$(openssl rand -base64 32)
# JWT_REFRESH_SECRET=$(openssl rand -base64 32)
# ENCRYPTION_KEY=$(openssl rand -hex 32)
# POSTGRES_USER=potok
# POSTGRES_PASSWORD=$(openssl rand -base64 24)
# POSTGRES_DB=potok
# REDIS_PASSWORD=$(openssl rand -base64 24)
# YOOKASSA_SHOP_ID=...
# YOOKASSA_SECRET_KEY=...
# YOOKASSA_WEBHOOK_SECRET=$(openssl rand -base64 32)
# ANTHROPIC_API_KEY=sk-ant-...
# MINIO_ACCESS_KEY=potok
# MINIO_SECRET_KEY=$(openssl rand -base64 24)
# GRAFANA_PASSWORD=$(openssl rand -base64 16)
```

### Step 3: TLS Certificate

```bash
# Start Nginx + Certbot for cert issuance
docker compose up -d nginx certbot

# Issue certificate
docker compose run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email admin@поток.ru \
  --agree-tos --no-eff-email \
  -d app.поток.ru

# Restart Nginx with TLS
docker compose restart nginx
```

### Step 4: Database Initialization

```bash
# Start database services only
docker compose up -d postgres redis

# Wait for postgres healthy
docker compose ps  # check status

# Run Prisma migrations
docker compose run --rm api npx prisma migrate deploy

# Verify schema
docker compose exec postgres psql -U potok -d potok -c "\dt"
```

### Step 5: Seed Warmup Pool

```bash
# Seed 100 Yandex accounts as warmup pool starters
docker compose run --rm worker npx tsx scripts/seed-warmup-pool.ts \
  --accounts ./scripts/seed-accounts.csv  # email,password,smtp_host,imap_host

# Verify pool size
docker compose exec postgres psql -U potok -d potok \
  -c "SELECT COUNT(*) FROM email_accounts WHERE in_warmup_pool = TRUE"
```

### Step 6: Full Stack Launch

```bash
# Launch all services
docker compose up -d

# Verify all containers healthy
docker compose ps

# Check logs for errors
docker compose logs --tail=50 api
docker compose logs --tail=50 worker
docker compose logs --tail=50 web

# Smoke test
curl -s https://app.поток.ru/api/health | jq .
# Expected: {"status":"ok","version":"1.0.0","uptime":...}
```

### Step 7: Post-Launch Verification

```bash
# Test registration flow
curl -X POST https://app.поток.ru/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Verify Grafana dashboards accessible
curl -s http://localhost:3002/health  # internal

# Check BullMQ warmup scheduler is running
docker compose exec redis redis-cli -a $REDIS_PASSWORD \
  keys "bull:warmup:repeat:*"
```

---

## 3. CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, feat/*, fix/*]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: potok_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/potok_test
          REDIS_URL: redis://localhost:6379

      - name: Integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/potok_test
          REDIS_URL: redis://localhost:6379

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          fail_ci_if_error: false

  build:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker images
        run: |
          docker build -f apps/api/Dockerfile -t potok-api:${{ github.sha }} .
          docker build -f apps/web/Dockerfile -t potok-web:${{ github.sha }} .
          docker build -f apps/worker/Dockerfile -t potok-worker:${{ github.sha }} .

      - name: Test Docker build
        run: docker compose -f docker-compose.test.yml up --exit-code-from test-runner

  deploy:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: deploy
          key: ${{ secrets.VPS_SSH_KEY }}
          port: 2222
          script: |
            cd /opt/potok
            git pull origin main
            docker compose build
            docker compose up -d --no-deps api
            docker compose up -d --no-deps web
            docker compose up -d --no-deps worker
            docker compose ps
            # Smoke test
            sleep 5
            curl -sf http://localhost:3000/health || (docker compose logs api && exit 1)
```

### Deployment Strategy

```
Branch strategy:
  main      → production (auto-deploy on push)
  feat/*    → development (CI only, no deploy)
  fix/*     → development (CI only, no deploy)

Deployment type: Rolling restart (no downtime)
  1. Build new images
  2. Replace api container (Nginx holds connections during restart)
  3. Replace web container
  4. Replace worker container (BullMQ drains gracefully on SIGTERM)

Rollback: git revert + re-deploy (< 5 min)
```

---

## 4. Monitoring & Alerting

### Grafana Dashboards

**Dashboard 1: System Health**
```
Panels:
  - CPU usage per container (%)
  - Memory usage per container (MB)
  - Disk usage (%)
  - Network I/O (MB/s)
  - PostgreSQL: active connections / total connections
  - Redis: memory used (MB) / connected clients
  - Docker container status (up/down)

Alert rules:
  CPU > 80% for 5min → Telegram alert
  Disk > 80% → Telegram alert
  Any container down → Telegram alert (PagerDuty for production)
```

**Dashboard 2: Warmup Performance**
```
Panels:
  - Warmup jobs/hr: success vs failed (line chart)
  - Inbox Score distribution: P25 / P50 / P75 / P95 (gauge)
  - Pool size over time (accounts in pool)
  - Score drop alerts count (last 24h)
  - Warmup queue depth (BullMQ)

Alert rules:
  Warmup job failure rate > 20% → Telegram alert
  Queue depth > 5,000 → Telegram alert
```

**Dashboard 3: Campaign Performance**
```
Panels:
  - Emails sent/hr
  - Bounce rate % (alert > 5%)
  - Reply rate % (goal: > 2%)
  - Open rate % (goal: > 40%)
  - Campaign send queue depth

Alert rules:
  Bounce rate > 5% for 1hr → Email + Telegram alert
  Email send queue depth > 10,000 → Telegram alert
```

**Dashboard 4: Business Metrics**
```
Panels:
  - MRR (from payment_events, daily)
  - New signups/day
  - Trial → Paid conversion rate (7-day rolling)
  - Active subscriptions by plan
  - Churn events/week
  - AI Reply Agent calls/day (Claude API cost tracking)
```

### Prometheus Metrics (custom)

```typescript
// apps/api/src/lib/metrics.ts
import client from 'prom-client'

// API metrics
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2],
})

// Business metrics
export const signupsTotal = new client.Counter({
  name: 'potok_signups_total',
  help: 'Total user registrations',
  labelNames: ['plan'],
})

export const paymentsTotal = new client.Counter({
  name: 'potok_payments_total',
  help: 'Total successful payments',
  labelNames: ['plan', 'period'],
})

export const warmupJobsTotal = new client.Counter({
  name: 'potok_warmup_jobs_total',
  help: 'Total warmup jobs processed',
  labelNames: ['status'],  // success|failed|skipped
})

export const inboxScoreGauge = new client.Gauge({
  name: 'potok_inbox_score',
  help: 'Inbox score by account',
  labelNames: ['account_id', 'provider'],
})

export const bullmqQueueDepth = new client.Gauge({
  name: 'potok_queue_depth',
  help: 'BullMQ queue depth',
  labelNames: ['queue'],
})
```

### Alerting Channels

```yaml
# monitoring/alertmanager.yml
route:
  receiver: telegram
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 12h

receivers:
  - name: telegram
    telegram_configs:
      - bot_token: ${TELEGRAM_BOT_TOKEN}
        chat_id: ${TELEGRAM_ALERT_CHAT_ID}
        message: |
          🚨 ALERT: {{ .GroupLabels.alertname }}
          Severity: {{ .CommonLabels.severity }}
          {{ range .Alerts }}
          Description: {{ .Annotations.description }}
          {{ end }}

  - name: email
    email_configs:
      - to: admin@поток.ru
        from: alerts@поток.ru
        smarthost: smtp.yandex.com:465
```

### Logging Strategy

```typescript
// Structured JSON logging (pino)
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization', 'body.password', 'body.credentials'],
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
})

// Log levels:
// ERROR: unhandled exceptions, payment failures, security events
// WARN:  rate limit hits, retry attempts, degraded service
// INFO:  user actions (register, subscribe, campaign launch)
// DEBUG: detailed flow (warmup steps, IMAP operations) — dev only
```

---

## 5. Rollback Strategy

### Application Rollback (< 5 min)

```bash
# Option 1: Git revert + redeploy
cd /opt/potok
git log --oneline -5              # find last good commit
git revert <bad_commit>           # creates revert commit
git push origin main              # triggers auto-deploy
# OR manual:
docker compose build
docker compose up -d --no-deps api web worker

# Option 2: Previous Docker image
docker compose stop api
docker run --rm potok-api:<previous_sha> ...
# (requires tagging images with git SHA in CI)
```

### Database Rollback

```bash
# Prisma down migration
docker compose run --rm api npx prisma migrate resolve --rolled-back <migration_name>

# Restore from backup (worst case)
docker compose stop api worker
docker compose exec postgres pg_restore \
  -U potok -d potok \
  /backups/potok_$(date -d 'yesterday' +%Y%m%d).dump
docker compose start api worker
```

### Version Tagging

```bash
# Tag releases for easy rollback
git tag v0.1.0-scaffold    # after /start
git tag v0.1.0-mvp         # after MVP features complete
git tag v1.0.0             # stable release
git push --tags
```

---

## 6. Operational Runbooks

### Runbook: Warmup Queue Stuck

```
Symptom: Warmup queue depth > 10,000, score not updating

Diagnosis:
  1. docker compose logs worker --tail=50
  2. Check Redis: docker compose exec redis redis-cli -a $REDIS_PASSWORD
     > LLEN bull:warmup:wait
     > LLEN bull:warmup:failed

Resolution:
  A. If IMAP timeout:
     - Reduce worker concurrency: WORKER_CONCURRENCY_WARMUP=5
     - Restart worker: docker compose restart worker

  B. If Yandex blocking:
     - Check bounce alerts in inbox_alerts table
     - Reduce dailyLimit for all accounts:
       UPDATE email_accounts SET daily_limit = 30 WHERE in_warmup_pool = TRUE;
     - Restart warmup scheduler

  C. If Redis OOM:
     - Clear old completed jobs:
       docker compose exec redis redis-cli -a $REDIS_PASSWORD
       > EVAL "return redis.call('del', unpack(redis.call('keys', 'bull:warmup:completed:*')))" 0
```

### Runbook: Payment Webhook Not Processing

```
Symptom: User paid but subscription not activated

Diagnosis:
  1. Check payment_events table:
     SELECT * FROM payment_events ORDER BY created_at DESC LIMIT 10;

  2. Check YooKassa dashboard for webhook delivery status

  3. Check API logs for webhook errors:
     docker compose logs api | grep "billing/webhook"

Resolution:
  A. Webhook not received:
     - Verify YooKassa webhook URL: https://app.поток.ru/api/billing/webhook
     - Check Nginx proxy config passes raw body (not parsed JSON)
     - Manually trigger from YooKassa dashboard

  B. Signature verification failing:
     - Verify YOOKASSA_WEBHOOK_SECRET matches YooKassa dashboard
     - Update .env + restart api

  C. Manual activation (emergency):
     UPDATE subscriptions SET status = 'active', plan = 'pro',
     current_period_end = NOW() + INTERVAL '1 month'
     WHERE user_id = '<user_id>';
     UPDATE users SET plan = 'pro' WHERE id = '<user_id>';
```

### Runbook: High Bounce Rate Alert

```
Symptom: Bounce rate > 5% alert fired

Diagnosis:
  SELECT
    c.name,
    COUNT(*) FILTER (WHERE s.status = 'bounced') AS bounces,
    COUNT(*) AS total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE s.status = 'bounced') / COUNT(*), 2) AS bounce_rate
  FROM email_sends s
  JOIN campaigns c ON s.campaign_id = c.id
  WHERE s.created_at > NOW() - INTERVAL '24 hours'
  GROUP BY c.name
  ORDER BY bounce_rate DESC;

Resolution:
  A. Specific campaign high bounce:
     - Pause campaign: UPDATE campaigns SET status = 'paused' WHERE id = '<id>';
     - Notify user to check contact list quality

  B. All campaigns high bounce:
     - Warmup email accounts have low inbox score (<70%)
     - Pause all running campaigns
     - Let warmup continue for 2+ weeks before re-enabling

  C. Specific domain bouncing:
     - Add domain to blacklist
     - Update contacts: UPDATE contacts SET status = 'bounced' WHERE email LIKE '%@bad-domain.ru';
```

### Runbook: Database Disk Full

```
Symptom: Disk alert > 80% or PostgreSQL write errors

Diagnosis:
  docker compose exec postgres psql -U potok -d potok -c "
    SELECT
      schemaname, tablename,
      pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;
  "

Resolution:
  A. warmup_events is largest (expected):
     - Partition by month and archive old data:
       DELETE FROM warmup_events WHERE created_at < NOW() - INTERVAL '90 days';
       VACUUM ANALYZE warmup_events;

  B. inbox_messages large:
     - Archive messages older than 6 months:
       DELETE FROM inbox_messages WHERE received_at < NOW() - INTERVAL '180 days';

  C. Increase VPS disk (AdminVPS panel):
     - No downtime required for disk expansion
     - Resize partition after disk expansion
```

---

## 7. Launch Plan

### Week -2: Beta Preparation

```
[ ] Telegram-канал @potok_outreach создан
[ ] Первые 3 поста: "Что такое warmup", "Почему Яндекс блокирует", "Как работает Поток"
[ ] 20 приглашений в закрытое beta тестирование
[ ] Seed warmup pool: 100 Яндекс аккаунтов
[ ] YooKassa sandbox тесты пройдены
```

### Week -1: Beta Launch

```
[ ] Ссылка на beta: https://app.поток.ru/register?beta=1
[ ] Собираем обратную связь от 20 beta пользователей
[ ] Fix critical bugs (p0)
[ ] Inbox Score: проверить что работает для Яндекс (target: ≥75%)
[ ] Первые платные конверсии через YooKassa тестовые
```

### Week 0: Public Launch

```
День 1 (Понедельник):
  08:00 - Публикация статьи на vc.ru:
          "Почему холодные письма попадают в спам Яндекс — и как это исправить"
  10:00 - Пост в Telegram-канале с ссылкой на статью
  12:00 - Запуск Product Hunt RU / каналы про outreach
  18:00 - Вечерний итог в Telegram (первые регистрации)

День 2-3:
  - Отвечать на все комментарии vc.ru
  - Пост в Telegram-сообществах: "Продажи и лидген", "B2B Россия"
  - Мониторинг метрик каждые 2 часа

День 7:
  - Итоговый пост "Первая неделя: X регистраций, Y платных"
  - Анализ conversion funnel
  - Prioritize top-requested features
```

### Success Metrics (Launch Week)

| Метрика | Target | Alarm |
|---------|:------:|:-----:|
| Регистраций | 50 | < 10 |
| Trial → Active warmup | 70% | < 40% |
| Time to Aha (первый inbox) | < 15 мин | > 30 мин |
| Платных конверсий | 5 | 0 |
| Bounce rate кампаний | < 3% | > 8% |
| Uptime | 99.5% | < 99% |

### Post-Launch Roadmap (M2–M3)

```
M2:
  - AI Reply Agent (Claude API) — фокус на SDR/Основателей
  - amoCRM + Bitrix24 интеграции
  - Telegram-уведомления о новых ответах

M3:
  - Multi-client Agency Workspace
  - A/B тестирование subject lines
  - Реферальная программа (20% recurring)
  - CSV export кампаний
```

---

> ⚠️ **Disclaimer:** Этот документ является операционным планом на основе текущих технических решений.
> Конкретные шаги могут потребовать адаптации в зависимости от реальных условий инфраструктуры.

---
description: Deploy Inkflow to staging or production VPS via Docker Compose.
  $ARGUMENTS: environment (staging|production|rollback) + optional --dry-run flag
---

# /deploy $ARGUMENTS

## Purpose

Zero-downtime rolling deployment to VPS (AdminVPS/HOSTKEY) via Docker Compose.
Source of truth: `docs/Completion.md` deployment procedures.

## Pre-Flight Checks

Before any deployment:
1. Run full test suite: `npm run test && npm run test:integration`
2. TypeScript check: `npm run type-check`
3. Lint: `npm run lint`
4. Check for uncommitted changes: `git status`
5. Verify target branch: `main` for production, `staging` for staging

## Staging Deployment

```bash
# 1. Build Docker images
docker compose -f docker-compose.yml -f docker-compose.staging.yml build

# 2. Push to registry (if configured)
docker compose push

# 3. Deploy to staging VPS via SSH
ssh deploy@staging.inkflow.io "
  cd /opt/inkflow
  git pull origin staging
  docker compose pull
  docker compose up -d --no-deps api web worker
  docker compose exec api npx prisma migrate deploy
"

# 4. Health check
curl -s https://staging.inkflow.io/api/health | jq .

# 5. Run smoke tests
npm run test:e2e -- --baseURL=https://staging.inkflow.io
```

## Production Deployment (zero-downtime)

```bash
# 1. Pull latest images
ssh deploy@inkflow.io "
  cd /opt/inkflow
  git pull origin main
  
  # 2. Build new images
  docker compose build
  
  # 3. Run migrations BEFORE switching traffic
  docker compose run --rm api npx prisma migrate deploy
  
  # 4. Rolling restart — one service at a time
  docker compose up -d --no-deps --scale api=2 api   # spin up new + keep old
  docker compose up -d --no-deps web
  docker compose up -d --no-deps worker
  
  # 5. Health check new instances
  curl -s http://localhost:3000/api/health
  
  # 6. Remove old containers
  docker compose up -d --remove-orphans
"

# 7. Verify from outside
curl -s https://inkflow.io/api/health | jq .
```

## Rollback

```bash
# Roll back to previous Docker image
ssh deploy@inkflow.io "
  cd /opt/inkflow
  git checkout HEAD~1
  docker compose up -d --no-deps api web worker
  # Note: do NOT rollback migrations automatically — assess first
"
```

## Post-Deployment Verification

After any deployment:
1. Health check: `GET /api/health` → 200
2. Prometheus metrics: `GET /metrics` → 200
3. Grafana dashboard: verify error rate, latency
4. Test critical path manually: subscribe → confirm → receive email

## Dry Run Mode

`/deploy production --dry-run` — show commands without executing:
- Lists all Docker Compose services to restart
- Shows migration diff
- Estimated downtime: 0s (rolling) or N seconds (forced)

## Environment Variables

Production secrets managed in `/opt/inkflow/.env` on VPS.
Never committed to git — managed manually or via secrets manager.

## Monitoring Post-Deploy

Check these Grafana panels after deploy:
- API p99 latency (target: <200ms)
- Error rate (target: <1%)
- Email queue depth (target: 0 pending after 5min)
- Active connections

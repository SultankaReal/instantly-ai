# /deploy [env] — Deploy to Environment

Deploy Поток to staging or production.

## Usage

```
/deploy staging     — deploy to staging VPS
/deploy production  — deploy to production VPS
/deploy rollback    — rollback to previous version
```

## Pre-deploy Checklist

Before deploying:
- [ ] All tests passing (`npm run test`)
- [ ] TypeScript compiles without errors
- [ ] `.env` file present on target VPS
- [ ] Database migrations ready
- [ ] `git tag v<version>` created

## Staging Deploy

```bash
ssh user@staging.поток.ru
cd /opt/potok
git pull origin main
docker compose pull
docker compose up -d --build

# Run migrations
docker compose exec api npx prisma migrate deploy

# Health check
curl https://api.staging.поток.ru/health
```

## Production Deploy (7-step runbook)

Follows `docs/Completion.md §2 Deployment Runbook`:

1. **Backup**: `docker exec postgres pg_dump potok > backup_$(date +%Y%m%d).sql`
2. **Pull**: `git pull origin main`
3. **Build**: `docker compose build --no-cache api web worker`
4. **Migrate**: `docker compose exec api npx prisma migrate deploy`
5. **Restart**: `docker compose up -d`
6. **Verify**: health checks for all 3 services
7. **Tag**: `git tag v<version>` if not already tagged

## Rollback

```bash
git revert HEAD
docker compose up -d --build
# or restore from backup:
docker exec -i postgres psql potok < backup_YYYYMMDD.sql
```

## Environment Variables

Production `.env` must contain all secrets from `.env.example`.
See `.claude/rules/secrets-management.md` for the full list.

# Completion — Substack Import Feature
**Date:** 2026-05-01

---

## Pre-Deployment Checklist

- [ ] `QUEUE_NAMES.IMPORT_SUBSCRIBERS` constant updated to `'import:substack'`
- [ ] `@fastify/multipart` registered in `app.ts` before routes
- [ ] Import routes registered in `app.ts`
- [ ] ZIP bomb check added to `import.worker.ts`
- [ ] Temp file path: both api and worker containers can access `os.tmpdir()`
- [ ] TypeScript typecheck passes across all packages
- [ ] `adm-zip` available in worker package (`apps/worker/package.json`)
- [ ] `csv-parse` available in worker package
- [ ] Frontend import page renders correctly at `/dashboard/import`
- [ ] Polling terminates when job reaches `completed` or `failed`
- [ ] Error states shown to user with actionable messages

## Deployment Notes

- The `api` and `worker` services in Docker Compose share the host's `/tmp` directory if no custom volume is set — this is the default and works for single-node VPS
- For future multi-node: add a `tmpfiles` Docker volume mounted to both services

## Monitoring

| Metric | What to Watch |
|--------|---------------|
| BullMQ `import:substack` queue depth | Alert if > 10 (stalled jobs) |
| Import worker concurrency | Should stay at 2 — not more |
| Temp disk usage | Alert if `/tmp` > 2 GB |
| Job failure rate | Alert if > 10% over 1 hour |

## Rollback

If the feature causes issues: remove `importRoutes` from `app.ts` registration. The worker can stay running — it simply won't receive new jobs. No DB migration needed.

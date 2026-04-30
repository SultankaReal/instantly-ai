# Architecture — Substack Import Feature
**Date:** 2026-05-01

---

## Overview

The import feature is an async upload-and-process pipeline. It reuses all existing infrastructure (BullMQ, Postgres, Redis) and adds a single new HTTP route pair plus a frontend page.

```
┌───────────────────────────────────────────────────────────────────┐
│  Browser (Next.js dashboard)                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  /dashboard/import — file picker, progress bar, summary     │ │
│  └──────────────────┬──────────────────────────────────────────┘ │
│                     │ POST multipart + GET status (poll 2s)       │
└─────────────────────┼─────────────────────────────────────────────┘
                      │
┌─────────────────────▼─────────────────────────────────────────────┐
│  apps/api (Fastify :3000)                                         │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  @fastify/multipart plugin (50 MB limit)                     │ │
│  │  importRoutes:                                               │ │
│  │    POST /api/publications/:pubId/import/substack             │ │
│  │      → validate ownership → save tmp file → enqueue job     │ │
│  │    GET  /api/publications/:pubId/import/:jobId/status        │ │
│  │      → validate ownership → BullMQ getJob → return state    │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                      │ importQueue.add()                           │
└──────────────────────┼─────────────────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────────────────┐
│  Redis (BullMQ)                                                     │
│  Queue: import:substack                                             │
│  Job payload: { publicationId, filePath, sendWelcome, initiatedBy } │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────────────────┐
│  apps/worker (BullMQ consumer)                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  import.worker.ts (concurrency: 2)                           │  │
│  │    1. Read ZIP from filePath (os.tmpdir)                     │  │
│  │    2. Check ZIP bomb (total uncompressed > 100 MB → reject)  │  │
│  │    3. Extract subscribers.csv                                │  │
│  │    4. Parse CSV rows                                         │  │
│  │    5. Validate + tier-map rows                               │  │
│  │    6. createMany(skipDuplicates: true) in 500-row batches    │  │
│  │    7. Enqueue welcome emails if sendWelcome                  │  │
│  │    8. Unlink temp file                                       │  │
│  │    9. Return { imported, failed, errors }                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────────────────┘
                       │
┌──────────────────────▼─────────────────────────────────────────────┐
│  PostgreSQL                                                         │
│  TABLE: subscribers                                                 │
│  UNIQUE(publication_id, email) → deduplication                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Locations

| Component | File | Status |
|-----------|------|--------|
| Queue constant fix | `packages/shared-types/src/queue/index.ts` | Edit existing |
| Multipart plugin | `apps/api/src/app.ts` | Edit existing |
| Import API routes | `apps/api/src/routes/import.ts` | **New** |
| Route registration | `apps/api/src/app.ts` | Edit existing |
| BullMQ queue helper | `apps/api/src/queues/import.ts` | **New** (API-side queue) |
| Import worker | `apps/worker/src/workers/import.worker.ts` | Edit (add ZIP bomb check) |
| Frontend import page | `apps/web/src/app/(dashboard)/dashboard/import/page.tsx` | **New** |

---

## Queue Name Convention

```
Queue:    import:substack
Producer: apps/api/src/routes/import.ts
Consumer: apps/worker/src/workers/import.worker.ts
Constant: QUEUE_NAMES.IMPORT_SUBSCRIBERS = 'import:substack'
```

The API creates its own `Queue` instance (producer-only) — it never consumes. The worker creates a `Worker` instance on the same queue name. Both use the shared Redis connection.

---

## Temp File Strategy

```
Path: os.tmpdir() + '/inkflow-import-' + crypto.randomUUID() + '.zip'
Lifecycle:
  Created: by API after upload stream completes
  Deleted: by worker after job finishes (success or failure)
  Orphan guard: future cron deletes files > 1 hour old
```

The API and worker may run in the same container (monorepo) or different containers. In production Docker Compose, both `api` and `worker` containers need access to the same `/tmp` — use a shared Docker volume if they run separately.

---

## Fastify Plugin Registration Order

```
buildApp():
  register(corsPlugin)
  register(dbPlugin)
  register(redisPlugin)
  register(authPlugin)
  register(multipartPlugin)   ← ADD HERE (before routes)
  register(healthRoutes)
  register(authRoutes)
  register(publicationRoutes)
  register(postRoutes)
  register(subscriberRoutes)
  register(importRoutes)      ← ADD HERE
  register(paymentRoutes)
  register(webhookRoutes)
  register(aiRoutes)
```

---

## Security Architecture

- Auth required on both endpoints (ownership check for pubId)
- File size enforced at HTTP layer (`@fastify/multipart limits.fileSize: 50 MB`)
- Magic bytes check prevents non-ZIP content types
- ZIP bomb check in worker prevents disk/memory exhaustion
- Temp file path uses UUID — no path traversal possible
- Job state endpoint validates publication ownership — no IDOR

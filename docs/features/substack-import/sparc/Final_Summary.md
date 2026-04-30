# Final Summary — Substack Import
**Date:** 2026-05-01

## Overview

Substack import enables authors to migrate their subscriber lists from Substack in one step. The BullMQ worker is already implemented; this feature delivers the API upload endpoint, job status polling, and dashboard UI that wires it all together.

## What's Already Built

- `apps/worker/src/workers/import.worker.ts` — ZIP parsing, CSV processing, DB upsert, welcome emails
- `apps/worker/src/queues/index.ts` — `importQueue`, `addImportJob()` helper
- `packages/shared-types` — `ImportJob` type, `JOB_NAMES.IMPORT_SUBSTACK`

## What This Feature Adds

1. Fix `QUEUE_NAMES` constant (`'import-subscribers'` → `'import:substack'`)
2. Register `@fastify/multipart` in `app.ts`
3. `apps/api/src/routes/import.ts` — upload + status endpoints
4. ZIP bomb protection in the worker (uncompressed > 100 MB → reject)
5. `apps/web/src/app/(dashboard)/dashboard/import/page.tsx` — upload UI + progress polling

## Implementation Order

1. Fix constant in `packages/shared-types`
2. Register multipart plugin + import routes in `app.ts`
3. Create `apps/api/src/routes/import.ts`
4. Add ZIP bomb check to `import.worker.ts`
5. Create frontend import page

## Key Risk: Queue Name Mismatch

The pre-existing `QUEUE_NAMES.IMPORT_SUBSCRIBERS = 'import-subscribers'` constant does NOT match the worker's hardcoded `'import:substack'`. If the API enqueues to the wrong queue name, no worker will consume the job. Fix this before anything else.

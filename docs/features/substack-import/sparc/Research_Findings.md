# Research Findings — Substack Import
**Date:** 2026-05-01

---

## Executive Summary

Substack exports a ZIP containing a `subscribers.csv` with columns: `email`, `type` (free/paid/comp), `created_at`, and optional `name`. The import pipeline is CPU-bound (ZIP extraction) and I/O-bound (DB upsert); async BullMQ processing is the correct architectural choice. ZIP bomb protection and file size limits are mandatory for production safety.

---

## Substack Export Format

**Source:** Substack Help Centre (public docs) + community analysis

### ZIP structure
```
substack-export-YYYY-MM-DD/
├── subscribers.csv          ← primary target
├── posts/                   ← HTML post archive (not needed for MVP)
└── ...
```

### subscribers.csv columns
| Column | Type | Notes |
|--------|------|-------|
| `email` | string | Always present, lowercase |
| `type` | string | `free` / `paid` / `comp` / `gift` |
| `created_at` | ISO-8601 | Subscription date, may be empty |
| `name` | string | Display name, often empty |
| `expiry_date` | string | For paid/gift — out of MVP scope |

**Tier mapping:**
- `paid` → `tier: 'paid'`
- `comp` → `tier: 'paid'` (complimentary = full access)
- `gift` → `tier: 'paid'`
- `free` / anything else → `tier: 'free'`

---

## ZIP Bomb Protection

**Risk:** A 42 KB ZIP can expand to 4.5 GB. Without a size check, the worker would exhaust disk/memory.

**Industry practice:**
- Check total uncompressed size before extracting (`adm-zip` provides `header.size` per entry)
- Reject if total uncompressed > 100 MB
- Also reject raw upload > 50 MB at HTTP layer

**adm-zip API:**
```typescript
const totalUncompressed = zip.getEntries().reduce((sum, e) => sum + e.header.size, 0);
if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) throw new UnrecoverableError('ZIP bomb detected');
```

---

## Magic Bytes Validation

ZIP files start with `PK\x03\x04` (bytes `50 4B 03 04`). Validate before passing to adm-zip:
```typescript
const magic = buffer.slice(0, 4);
if (magic.toString('hex') !== '504b0304') throw new Error('Not a valid ZIP file');
```

---

## @fastify/multipart

- `@fastify/multipart` v8 is already in `apps/api/package.json`
- Must be registered as a plugin before routes that need multipart
- File size limit enforced via `limits.fileSize` option
- Files arrive as Node.js `Readable` streams; must be piped to `fs.createWriteStream` for temp storage
- Temp file path: use `os.tmpdir()` + `crypto.randomUUID()` for uniqueness

---

## BullMQ Job Status API

BullMQ `Queue.getJob(jobId)` returns a `Job | null`. Job state can be read via `job.getState()`:
- `'waiting'` | `'active'` | `'completed'` | `'failed'` | `'delayed'` | `'unknown'`

`job.progress` gives the numeric 0–100 value set by `job.updateProgress()`.
`job.returnvalue` holds the completed result.
`job.failedReason` holds the error string on failure.

---

## Queue Name Inconsistency (pre-existing bug)

**Critical finding:** 
- `packages/shared-types` defines `QUEUE_NAMES.IMPORT_SUBSCRIBERS = 'import-subscribers'`
- `apps/worker/src/workers/import.worker.ts` uses hardcoded `'import:substack'`
- `apps/worker/src/queues/index.ts` uses `importQueue = new Queue('import:substack', ...)`

The API upload route must enqueue to `'import:substack'` to match what the worker actually listens on. The `QUEUE_NAMES.IMPORT_SUBSCRIBERS` constant is stale/unused. Fix: update the constant to `'import:substack'` and use it everywhere.

---

## Deduplication Strategy

Postgres `UNIQUE(publication_id, email)` constraint + Prisma `createMany({ skipDuplicates: true })` = zero-cost deduplication at DB layer. No pre-query needed. Re-importing the same export is safe.

---

## File Cleanup

Temp files must be deleted after job completion OR failure. The worker already does `fs.unlinkSync(filePath)` post-processing. For catastrophic failures (worker crash), a cron-based cleanup of `/tmp/inkflow-import-*` files older than 1 hour is recommended but out of MVP scope.

---

## Confidence Assessment

- **High confidence:** Substack CSV format (documented + community verified)
- **High confidence:** adm-zip API for size checks
- **High confidence:** @fastify/multipart API (v8 stable)
- **Medium confidence:** ZIP bomb thresholds (50 MB / 100 MB are industry norms, not Substack-specific)

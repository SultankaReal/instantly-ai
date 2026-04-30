# Solution Strategy — Substack Import
**Date:** 2026-05-01

---

## SCQA Analysis

- **Situation:** Inkflow has a fully implemented BullMQ import worker that parses Substack ZIPs and upserts subscribers. The queue infrastructure and job types are all defined.
- **Complication:** There is no API endpoint to receive the upload, no multipart plugin registration, and no frontend UI. Authors cannot trigger the import despite the back-end being ready.
- **Question:** What is the minimal, correct set of changes to wire the existing back-end into a working user-facing feature?
- **Answer:** Register `@fastify/multipart`, add one upload route + one status route, create a single dashboard page with a file picker and progress polling.

---

## First Principles

Breaking down what import actually is:
1. **File transfer** — author's machine → API server tmp storage
2. **Job dispatch** — tmp file path → BullMQ queue → worker
3. **Data transformation** — ZIP → CSV rows → Postgres rows
4. **Feedback loop** — polling job status → UI progress bar

Steps 3 and 4 (data transformation side) are already complete. Steps 1 and 2 are missing. Step 4 (UI) is missing.

---

## TRIZ Contradictions Resolved

| Contradiction | Principle Used | Resolution |
|---------------|----------------|------------|
| Large files (safety) vs fast response | #10 Prior Action | Validate file at upload time, defer work to background |
| ZIP bomb risk vs not blocking valid files | #35 Parameter Change | Check uncompressed size in worker, not raw bytes |
| Progress visibility vs stateless HTTP | #10 Prior Action | Client polls a status endpoint rather than SSE |
| File cleanup vs crash resilience | #22 Convert Harm to Benefit | Worker deletes on success, cron handles orphans |

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ZIP bomb crashes worker | Low | Critical | `adm-zip` size check before extraction |
| Upload > 50 MB hangs API | Medium | High | `limits.fileSize` in `@fastify/multipart` |
| Orphaned temp files on worker crash | Medium | Medium | File path includes timestamp; future cron cleanup |
| Queue name mismatch API↔Worker | **Confirmed** | Critical | Fix `QUEUE_NAMES` constant + use it everywhere |
| Duplicate welcome emails on re-import | Medium | Medium | `addWelcomeEmail` jobId = `welcome:pubId:subId` (deduped) |
| Author uploads non-Substack CSV | Medium | Low | Magic bytes check + subscribers.csv not found = clear error |

---

## Implementation Order

1. Fix `QUEUE_NAMES.IMPORT_SUBSCRIBERS` constant → `'import:substack'`
2. Register `@fastify/multipart` in `app.ts` with 50 MB limit
3. Create `apps/api/src/routes/import.ts` — upload + status endpoints
4. Register import routes in `app.ts`
5. Create `apps/web/src/app/(dashboard)/dashboard/import/page.tsx` — file picker + progress
6. Add import nav link to dashboard sidebar

---

## Architecture Decision: Polling vs SSE

**SSE** would give real-time progress but requires persistent HTTP connection. BullMQ job processing takes 5–60 seconds for typical exports. **Polling** every 2 seconds is simpler, works behind all proxies, and the UX difference is imperceptible for a background task.

**Decision:** Polling `GET /api/publications/:pubId/import/:jobId/status` every 2 seconds until `completed` or `failed`.

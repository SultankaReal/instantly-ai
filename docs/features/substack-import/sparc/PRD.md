# PRD — Substack Import Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## Problem Statement

Authors migrating from Substack have no way to bring their subscriber list into Inkflow today. The manual alternative — downloading a Substack export, reformatting the CSV, and doing a raw DB insert — is inaccessible and error-prone for non-technical users. Without import, the platform is dead-on-arrival for any existing Substack author.

**Impact:** Zero migration path = zero existing creator adoption.

---

## Solution Summary

Implement a one-step Substack ZIP import flow:
1. Author uploads the Substack export ZIP from the Inkflow dashboard.
2. API saves it to a temp file, enqueues a BullMQ `import:substack` job.
3. Worker extracts `subscribers.csv`, validates rows, maps free/paid tiers, bulk-upserts to Postgres.
4. Frontend polls job status and shows a live progress bar + summary on completion.

---

## Feature Matrix

| Capability | MVP | v1.0 |
|-----------|-----|------|
| ZIP upload (≤50 MB) | ✅ | ✅ |
| CSV parsing + tier mapping (free/paid/comp) | ✅ | ✅ |
| Deduplication (`skipDuplicates: true`) | ✅ | ✅ |
| Optional welcome email to imported subscribers | ✅ | ✅ |
| Job status polling (success / failure / progress %) | ✅ | ✅ |
| ZIP bomb protection (uncompressed size limit) | ✅ | ✅ |
| Magic bytes validation (ZIP header check) | ✅ | ✅ |
| Row-level error log (first 10 bad emails) | ✅ | ✅ |
| Duplicate archive detection (same job for same file) | ❌ | ✅ |
| Google Contacts / Mailchimp import | ❌ | v2.0 |

---

## User Stories

1. **US-01** — Upload: As an author, I upload my Substack ZIP and see a confirmation that the import started.
2. **US-02** — Progress: As an author, I see live progress (0–100%) while the import runs.
3**US-03** — Summary: After completion, I see how many subscribers were imported, how many skipped (duplicates), and the first 10 invalid rows.
4. **US-04** — Error: If the ZIP is corrupt, missing CSV, or over 50 MB, I receive a clear error message without data loss.
5. **US-05** — Welcome email: I can opt-in to send a welcome email to every newly imported subscriber.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Import latency (10k subscribers) | < 30 seconds |
| Row accuracy (valid CSV) | 100% — no silent drops |
| Duplicate protection | 0 re-imports of same email |
| ZIP bomb rejection | Any file expanding > 100 MB rejected |
| Error visibility | First 10 invalid rows shown in summary |

---

## Constraints

- File size limit: 50 MB raw ZIP (enforced at API level)
- Uncompressed limit: 100 MB (ZIP bomb guard in worker)
- No EU users until GDPR consent_log is implemented (see security.md)
- Worker concurrency: 2 (CPU-bound ZIP parsing)
- Queue: BullMQ `import:substack`

---

## Dependencies

- `@fastify/multipart` — multipart form parsing (already in package.json)
- `adm-zip` — ZIP extraction (already in worker package.json)
- `csv-parse` — CSV parsing (already in worker package.json)
- `@inkflow/shared-types` `ImportJob` type — already defined
- BullMQ import worker — already implemented in `apps/worker/src/workers/import.worker.ts`
- Queue helper `addImportJob()` — already in `apps/worker/src/queues/index.ts`

> ⚠️ **Pre-existing:** The worker and queue infrastructure are already implemented. This feature's primary work is the API upload endpoint + frontend UI.

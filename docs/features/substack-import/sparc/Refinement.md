# Refinement — Substack Import Feature
**Date:** 2026-05-01

---

## Edge Cases Matrix

| Scenario | Input | Expected Behavior | Handling |
|----------|-------|-------------------|----------|
| ZIP > 50 MB | 60 MB file | HTTP 413 FILE_TOO_LARGE | @fastify/multipart `limits.fileSize` |
| ZIP bomb | Small ZIP, >100 MB uncompressed | Worker fails with UnrecoverableError | `adm-zip` header.size sum check |
| Non-ZIP file | .csv uploaded directly | HTTP 422 INVALID_FILE_TYPE | Magic bytes check in API |
| Missing subscribers.csv | ZIP without the file | Worker fails, message: "subscribers.csv not found" | Worker already handles this |
| Corrupt subscribers.csv | Unparseable CSV | Worker fails, message: "Failed to parse subscribers.csv" | Worker already handles this |
| Empty subscribers.csv | 0 data rows | Import completes, imported: 0 | createMany with empty array = no-op |
| All duplicates | Every email already exists | imported: 0, skipDuplicates handles it | createMany skipDuplicates:true |
| No file field in multipart | Missing "file" field | HTTP 422 NO_FILE | Check fileData === null in route |
| Worker crashes mid-import | SIGKILL during processing | BullMQ retries job (attempts:5) | Idempotent createMany |
| Re-upload of same ZIP | Same file uploaded twice | Both jobs run; second has imported:0 (all dups) | createMany skipDuplicates handles |
| Publication doesn't exist | Invalid pubId | HTTP 404 PUBLICATION_NOT_FOUND | Publication lookup in route |
| Other author's publication | pubId owned by others | HTTP 403 FORBIDDEN | publication.author_id check |
| Job not found on status | Stale/expired jobId | HTTP 404 JOB_NOT_FOUND | importQueue.getJob returns null |
| Very large valid CSV | 100k rows | Processes in 200 batches of 500, updates progress | DB_BATCH_SIZE=500 batching |
| Substack `comp` subscribers | type="comp" | Mapped to tier:'paid' | Explicit mapping in worker |
| Email with uppercase | "USER@DOMAIN.COM" | Lowercased before storage | `.toLowerCase()` in worker |
| Missing created_at | Empty string | `new Date()` used as fallback | try/catch + fallback in worker |
| sendWelcome with 0 new imports | All dupes | No welcome emails sent | `if (imported > 0)` guard |
| Concurrent uploads by same author | Two simultaneous uploads | Both process independently | No race condition (separate jobs) |

---

## Security Hardening

### ZIP Bomb Protection
```typescript
// In import.worker.ts, BEFORE extracting any content:
const MAX_UNCOMPRESSED = 100 * 1024 * 1024; // 100 MB
const totalUncompressed = zip.getEntries().reduce((sum, e) => sum + e.header.size, 0);
if (totalUncompressed > MAX_UNCOMPRESSED) {
  throw new UnrecoverableError(
    `ZIP bomb detected — uncompressed size ${totalUncompressed} exceeds 100 MB limit`,
  );
}
```

### Magic Bytes Validation
```typescript
// In API upload route — read first 4 bytes from stream header
// Note: @fastify/multipart file.file is a Readable
// Better: let the stream complete, then check the saved file
// Or: use file._readableState.buffer peek via 'peek' lib — but simpler:
// Read the saved file's first 4 bytes after writing
const header = Buffer.alloc(4);
const fd = fs.openSync(tmpPath, 'r');
fs.readSync(fd, header, 0, 4, 0);
fs.closeSync(fd);
if (header.toString('hex') !== '504b0304') {
  fs.unlinkSync(tmpPath);
  return reply.status(422).send({ error: { code: 'INVALID_FILE_TYPE', ... } });
}
```

### Path Traversal Prevention
Temp filename uses `crypto.randomUUID()` — no user input in the path. The worker receives the path from the job payload (trusted internal channel).

---

## Testing Strategy

### Unit Tests

| Test | File | What to verify |
|------|------|----------------|
| `uploadSubstackImport` route | `import.test.ts` | 202 for valid ZIP, 413 for large, 422 for non-ZIP, 403 for wrong author |
| `getImportStatus` route | `import.test.ts` | 200 with correct fields, 404 for unknown job, 403 for wrong author |
| `parseSubstackExport` worker | `import.worker.test.ts` | CSV parsing, tier mapping, duplicate handling, ZIP bomb detection |
| Queue name constant | sanity check | QUEUE_NAMES.IMPORT_SUBSCRIBERS === 'import:substack' |

### Integration Tests

1. **Full import flow**: Upload real Substack fixture ZIP → job completes → subscribers in DB
2. **Duplicate deduplication**: Import same ZIP twice → second run shows imported:0
3. **ZIP bomb rejection**: Upload crafted ZIP with oversized uncompressed content → job fails

### Test Fixtures

Create `tests/fixtures/substack-export.zip` containing `subscribers.csv`:
```csv
email,type,created_at,name
alice@example.com,free,2024-01-01T00:00:00Z,Alice
bob@example.com,paid,2024-02-01T00:00:00Z,Bob
carol@example.com,comp,2024-03-01T00:00:00Z,Carol
invalid-email,free,2024-04-01T00:00:00Z,Invalid
```

Expected: imported=3, failed=1, errors=["Invalid email: \"invalid-email\""]

---

## Technical Debt Items

| Item | Priority | Notes |
|------|----------|-------|
| Shared Docker volume for `/tmp` | Medium | Required if api + worker in separate containers |
| Orphan temp file cleanup cron | Low | `find /tmp -name 'inkflow-import-*' -mmin +60 -delete` |
| Job deduplication for same file | Low | Use SHA-256 of ZIP content as jobId |
| Chunked upload for >50 MB | Future | TUS protocol or S3 direct upload |

---

## ADRs

### ADR-1: Polling vs SSE for progress

**Decision:** Polling every 2s.
**Rationale:** SSE requires persistent connections that may timeout behind proxies. Import jobs take 5–60 seconds — polling at 2s gives responsive UX without the complexity.

### ADR-2: Temp file via API, not S3

**Decision:** Save to `os.tmpdir()`, pass path to worker.
**Rationale:** Avoiding S3 upload/download roundtrip reduces latency by ~2 seconds. Acceptable if API and worker share the same filesystem (Docker Compose default). Production multi-host deployment would need S3.

### ADR-3: Magic bytes in API, ZIP bomb in worker

**Decision:** Magic bytes checked immediately at API (before writing to disk is complete) and ZIP bomb checked in worker (after adm-zip loads the headers).
**Rationale:** API checks the fast/easy thing (4 bytes). Worker checks the expensive thing (iterate all entries) since it has the full file. Both checks needed.

# Specification — Substack Import Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## 1. User Stories

### US-01: Upload Substack Export

**As an** author,
**I want to** upload my Substack ZIP export,
**So that** my subscriber list is imported into Inkflow.

```gherkin
Feature: Upload Substack export

  Background:
    Given I am authenticated as an author
    And I own publication "pub-123"

  Scenario: Successful upload triggers import job
    When I POST /api/publications/pub-123/import/substack with a valid ZIP (multipart, field "file")
    And optionally include sendWelcome: "true"
    Then the response status is 202
    And the response contains { jobId: "<uuid>", status: "queued" }
    And a BullMQ job is enqueued on "import:substack" queue

  Scenario: File exceeds 50 MB limit
    When I POST with a ZIP file larger than 50 MB
    Then the response status is 413
    And the error code is "FILE_TOO_LARGE"

  Scenario: Non-ZIP file uploaded
    When I POST with a file that is not a ZIP (magic bytes mismatch)
    Then the response status is 422
    And the error code is "INVALID_FILE_TYPE"

  Scenario: Unauthorized — author does not own publication
    Given I am authenticated as "other-author"
    When I POST /api/publications/pub-123/import/substack
    Then the response status is 403
```

---

### US-02: Poll Import Progress

**As an** author,
**I want to** see live progress while my import is running,
**So that** I know it hasn't stalled.

```gherkin
Feature: Import job status

  Scenario: Active job returns progress
    Given a BullMQ job with id "job-456" is active
    When I GET /api/publications/pub-123/import/job-456/status
    Then the response status is 200
    And the response contains { state: "active", progress: 45 }

  Scenario: Completed job returns summary
    Given job "job-456" completed successfully with 980 imported, 20 skipped
    When I GET /api/publications/pub-123/import/job-456/status
    Then the response status is 200
    And { state: "completed", result: { imported: 980, failed: 20, errors: [...] } }

  Scenario: Failed job returns error
    Given job "job-456" failed with "subscribers.csv not found"
    When I GET /api/publications/pub-123/import/job-456/status
    Then the response status is 200
    And { state: "failed", reason: "subscribers.csv not found inside the ZIP archive." }

  Scenario: Unknown job id
    When I GET /api/publications/pub-123/import/nonexistent-id/status
    Then the response status is 404
```

---

### US-03: View Import Summary

**As an** author,
**I want to** see how many subscribers were imported, skipped, and which rows were invalid,
**So that** I know the quality of my import.

```gherkin
Feature: Import completion summary

  Scenario: Summary shows breakdown
    Given import completed with 980 imported, 20 invalid rows
    When the frontend polling detects state "completed"
    Then the UI shows:
      | Imported    | 980 |
      | Skipped (dupes) | (980 - result.imported via DB skipDuplicates) |
      | Invalid rows | 20 |
    And if errors.length > 0, the first 10 invalid email rows are listed

  Scenario: Welcome email opt-in
    Given sendWelcome was "true" on upload
    Then the worker enqueues a "send-welcome" job for each newly imported subscriber
```

---

### US-04: Error Handling

**As an** author,
**I want to** receive clear error messages when my import fails,
**So that** I can fix the problem and retry.

```gherkin
Feature: Import error handling

  Scenario: ZIP bomb rejected
    Given the uploaded ZIP contains files expanding to more than 100 MB
    When the worker processes the job
    Then the job fails with reason "ZIP bomb detected — uncompressed size exceeds 100 MB"
    And the status endpoint returns { state: "failed", reason: "..." }

  Scenario: Missing subscribers.csv
    Given the ZIP does not contain subscribers.csv
    When the worker processes the job
    Then the job fails with reason "subscribers.csv not found inside the ZIP archive"

  Scenario: Corrupt CSV
    Given subscribers.csv contains unparseable content
    When the worker processes the job
    Then the job fails with reason "Failed to parse subscribers.csv: ..."
```

---

## 2. API Endpoints

### New endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/publications/:pubId/import/substack` | required | Upload ZIP, enqueue job |
| `GET` | `/api/publications/:pubId/import/:jobId/status` | required | Poll job status |

### Upload endpoint

**Request:**
```
POST /api/publications/:pubId/import/substack
Content-Type: multipart/form-data

Fields:
  file: <ZIP binary, max 50 MB>
  sendWelcome: "true" | "false"  (optional, default "false")
```

**Response 202:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "queued"
  }
}
```

**Error codes:** `FILE_TOO_LARGE` (413), `INVALID_FILE_TYPE` (422), `PUBLICATION_NOT_FOUND` (404), `FORBIDDEN` (403)

### Status endpoint

**Response 200:**
```json
{
  "success": true,
  "data": {
    "jobId": "string",
    "state": "waiting" | "active" | "completed" | "failed" | "delayed",
    "progress": 0-100,
    "result": { "imported": N, "failed": N, "errors": [...] } | null,
    "reason": "string | null"
  }
}
```

---

## 3. Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Max upload size | 50 MB (enforced at HTTP layer via `@fastify/multipart limits.fileSize`) |
| ZIP bomb guard | Reject if total uncompressed > 100 MB (enforced in worker) |
| Magic bytes check | First 4 bytes must be `50 4B 03 04` |
| Temp file storage | `os.tmpdir()/inkflow-import-<uuid>.zip` |
| DB batch size | 500 rows per `createMany` call |
| Worker concurrency | 2 (CPU-bound) |
| Queue name | `import:substack` (worker and API must match) |
| Job deduplication | None in MVP — same ZIP can be re-uploaded |
| Polling interval | Frontend polls every 2 seconds |
| Tier mapping | `paid`/`comp`/`gift` → `tier: 'paid'`; everything else → `tier: 'free'` |

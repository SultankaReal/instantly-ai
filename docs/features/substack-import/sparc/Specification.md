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
**So that** I know it hasn't stalled and I don't have to refresh the page.

```gherkin
Feature: Import job status

  Background:
    Given I am authenticated as an author and own publication "pub-123"

  Scenario: Active job returns progress in range 0–100
    Given a BullMQ job "job-456" is active on queue "import:substack"
    When I GET /api/publications/pub-123/import/job-456/status
    Then the response status is 200
    And response.data.state is "active"
    And response.data.progress is a number between 0 and 100 inclusive

  Scenario: Completed job returns numeric summary
    Given job "job-456" completed with 980 imported and 20 invalid rows
    When I GET /api/publications/pub-123/import/job-456/status
    Then the response status is 200
    And response.data.state is "completed"
    And response.data.result.imported is 980
    And response.data.result.failed is 20

  Scenario: Failed job returns reason string
    Given job "job-456" failed
    When I GET /api/publications/pub-123/import/job-456/status
    Then the response status is 200
    And response.data.state is "failed"
    And response.data.reason is a non-empty string

  Scenario: Unknown job id returns 404
    When I GET /api/publications/pub-123/import/nonexistent-id/status
    Then the response status is 404
    And the error code is "JOB_NOT_FOUND"

  Scenario: Author B cannot poll author A's job
    Given job "job-456" was created by author A for publication "pub-123"
    And I am authenticated as author B who does not own "pub-123"
    When I GET /api/publications/pub-123/import/job-456/status
    Then the response status is 403
    And the error code is "FORBIDDEN"
```

---

### US-03: View Import Summary

**As an** author,
**I want to** see how many subscribers were imported, skipped (duplicates), and invalid (bad email format),
**So that** I can verify the data quality of my import without checking the database manually.

```gherkin
Feature: Import completion summary

  Background:
    Given I am authenticated as an author and own publication "pub-123"
    And publication "pub-123" already has subscriber "bob@example.com"

  Scenario: Summary shows concrete imported / skipped / invalid counts
    Given I uploaded a CSV with 1000 rows: 980 new valid emails, 1 duplicate (bob@example.com), 19 invalid emails
    When the import job completes
    Then GET /api/publications/pub-123/import/:jobId/status returns:
      | result.imported | 980 |
      | result.failed   | 19  |
    And result.errors contains up to 10 invalid email strings
    And bob@example.com is not re-inserted (deduplicated by DB unique constraint)

  Scenario: Welcome emails enqueued for newly imported subscribers only
    Given I uploaded the ZIP with sendWelcome: "true"
    And the import job completes with 980 new subscribers
    Then 980 jobs are enqueued on queue "email:welcome"
    And no welcome job is enqueued for the 1 duplicate (bob@example.com)
```

---

### US-04: Recover from Import Failure

**As an** author,
**I want to** see a specific error message when my import fails,
**So that** I know whether to fix my export file or contact support.

```gherkin
Feature: Import failure recovery

  Background:
    Given I am authenticated as an author and own publication "pub-123"

  Scenario: ZIP bomb rejected by worker
    Given I uploaded a ZIP whose total uncompressed size exceeds 100 MB
    When the worker processes the job
    Then the job fails with an UnrecoverableError
    And GET /api/publications/pub-123/import/:jobId/status returns:
      | state  | "failed"                                              |
      | reason | starts with "ZIP bomb detected"                       |

  Scenario: Missing subscribers.csv
    Given the ZIP does not contain a file named "subscribers.csv" (case-insensitive)
    When the worker processes the job
    Then the job fails
    And reason starts with "subscribers.csv not found"

  Scenario: Corrupt CSV
    Given subscribers.csv contains unparseable binary content
    When the worker processes the job
    Then the job fails
    And reason starts with "Failed to parse subscribers.csv"
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

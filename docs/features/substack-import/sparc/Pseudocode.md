# Pseudocode — Substack Import Feature
**Date:** 2026-05-01

---

## 1. Fix Queue Name Constant

**File:** `packages/shared-types/src/queue/index.ts`

```
QUEUE_NAMES = {
  EMAIL_SEND: 'email-send',
  IMPORT_SUBSCRIBERS: 'import:substack',   // was 'import-subscribers' — fix to match worker
} as const
```

---

## 2. Register @fastify/multipart

**File:** `apps/api/src/app.ts`

```
AFTER registering infrastructure plugins (cors, db, redis, auth):
  REGISTER @fastify/multipart with:
    limits:
      fileSize: 50 * 1024 * 1024   // 50 MB
      files: 1                      // one file per request
      fields: 5
BEFORE registering routes
```

---

## 3. Algorithm: uploadSubstackImport

**File:** `apps/api/src/routes/import.ts`

```
POST /api/publications/:pubId/import/substack
  preHandler: [authenticate]

INPUT:
  pubId: UUID (path param)
  multipart file field "file"
  form field "sendWelcome": string ("true"|"false")
  userId: string (from JWT)

STEPS:
1. VERIFY publication exists AND publication.author_id === userId
   IF not found → 404 PUBLICATION_NOT_FOUND
   IF not owner → 403 FORBIDDEN

2. PARSE multipart request:
   const parts = request.parts()
   FOR EACH part in parts:
     IF part.type === 'file' AND part.fieldname === 'file':
       fileData = part
     IF part.type === 'field' AND part.fieldname === 'sendWelcome':
       sendWelcome = part.value === 'true'

3. IF fileData is null:
   RETURN 422 { error: { code: 'NO_FILE', message: 'No file uploaded' } }

4. SAVE to temp file FIRST (before magic bytes check):
   // Stream must not be split; write entire stream to disk, then inspect
   tmpPath = path.join(os.tmpdir(), `inkflow-import-${crypto.randomUUID()}.zip`)
   PIPE fileData.file stream → fs.createWriteStream(tmpPath)
   AWAIT stream 'finish' event

   // @fastify/multipart enforces the 50 MB limit — if exceeded, it emits
   // RequestEntityTooLargeError on the multipart stream before writing completes

5. VALIDATE magic bytes (after file is fully written):
   Open tmpPath for reading
   Read first 4 bytes
   Close file
   IF bytes !== '504b0304' (hex):
     fs.unlinkSync(tmpPath)
     RETURN 422 { error: { code: 'INVALID_FILE_TYPE', message: 'Uploaded file is not a valid ZIP' } }

6. ENQUEUE import job:
   job = await importQueue.add(JOB_NAMES.IMPORT_SUBSTACK, {
     publicationId: pubId,
     filePath: tmpPath,
     sendWelcome,
     initiatedBy: userId,
   })

7. RETURN 202 { success: true, data: { jobId: job.id, status: 'queued' } }

ERROR HANDLING:
  RequestEntityTooLargeError → 413 FILE_TOO_LARGE
  Any other error → clean up tmpPath if it exists, re-throw
```

---

## 4. Algorithm: getImportStatus

**File:** `apps/api/src/routes/import.ts`

```
GET /api/publications/:pubId/import/:jobId/status
  preHandler: [authenticate]

INPUT:
  pubId: UUID (path param)
  jobId: string (path param)
  userId: string (from JWT)

STEPS:
1. VERIFY publication ownership (same as above)
   IF not owner → 403

2. FETCH job from BullMQ:
   job = await importQueue.getJob(jobId)
   IF job is null → 404 { error: { code: 'JOB_NOT_FOUND' } }

   // Verify job belongs to this publication (prevents IDOR)
   IF job.data.publicationId !== pubId:
     RETURN 403 { error: { code: 'FORBIDDEN', message: 'Job does not belong to this publication' } }

3. GET job state:
   state = await job.getState()
   progress = job.progress as number ?? 0
   result = state === 'completed' ? job.returnvalue : null
   reason = state === 'failed' ? job.failedReason : null

4. RETURN 200 {
     success: true,
     data: { jobId, state, progress, result, reason }
   }
```

---

## 5. Algorithm: parseSubstackExport (Worker — already implemented)

**File:** `apps/worker/src/workers/import.worker.ts` ← already exists

**Summary of existing implementation:**
```
1. Open ZIP via adm-zip
2. Find subscribers.csv entry (case-insensitive)
3. Parse CSV with csv-parse/sync → SubstackSubscriberRow[]
4. For each row:
   - Validate email format
   - Map type (paid/comp/gift → 'paid', else 'free')
   - Parse created_at (fallback to now)
5. Batch upsert 500 rows at a time with createMany skipDuplicates:true
6. Report progress 0–100 via job.updateProgress()
7. Optionally enqueue welcome emails
8. Delete temp file
9. Return { imported, failed, errors }
```

**Missing piece:** ZIP bomb check before extraction. Add:
```
AFTER opening ZIP:
  totalUncompressed = sum of entry.header.size for all entries
  IF totalUncompressed > 100 * 1024 * 1024:
    THROW UnrecoverableError('ZIP bomb detected — uncompressed size exceeds 100 MB')
```

---

## 6. Frontend: ImportPage

**File:** `apps/web/src/app/(dashboard)/dashboard/import/page.tsx`

```
STATE:
  file: File | null
  sendWelcome: boolean
  uploading: boolean
  jobId: string | null
  jobState: 'idle' | 'queued' | 'active' | 'completed' | 'failed'
  progress: number (0–100)
  result: { imported, failed, errors } | null
  reason: string | null
  errorMsg: string

ON FILE SELECT:
  file = event.target.files[0]
  IF file.size > 50 * 1024 * 1024:
    errorMsg = 'File must be smaller than 50 MB'
    RETURN

ON SUBMIT:
  IF !file RETURN
  uploading = true
  errorMsg = ''

  form = new FormData()
  form.append('file', file)
  form.append('sendWelcome', String(sendWelcome))

  CALL POST /api/publications/:pubId/import/substack with form
  IF success:
    jobId = response.data.jobId
    jobState = 'queued'
    START polling loop
  IF error:
    errorMsg = error.message
  uploading = false

POLLING LOOP (every 2 seconds, stop when completed/failed or after 10 minutes):
  pollCount = 0
  MAX_POLLS = 300  // 300 × 2s = 10 minutes max
  WHILE jobState !== 'completed' AND jobState !== 'failed' AND pollCount < MAX_POLLS:
    response = GET /api/publications/:pubId/import/:jobId/status
    jobState = response.data.state
    progress = response.data.progress
    IF jobState === 'completed': result = response.data.result
    IF jobState === 'failed': reason = response.data.reason
    pollCount++
    SLEEP 2000
  IF pollCount >= MAX_POLLS AND jobState === 'active':
    reason = 'Import is taking longer than expected. Please refresh the page to check status.'
    jobState = 'failed'  // show error UI

RENDER:
  IF jobState === 'idle':
    SHOW file picker + sendWelcome checkbox + Submit button
  IF jobState === 'queued' OR 'active':
    SHOW progress bar (progress%)
    SHOW "Importing your subscribers..."
  IF jobState === 'completed':
    SHOW success summary (imported, skipped, invalid rows list)
    SHOW "Import another" button
  IF jobState === 'failed':
    SHOW error message (reason)
    SHOW "Try again" button
```

---

## 7. API Contracts

### POST /api/publications/:pubId/import/substack

**Request:** multipart/form-data
- `file`: ZIP binary
- `sendWelcome`: "true" | "false"

**Response 202:**
```json
{ "success": true, "data": { "jobId": "uuid", "status": "queued" } }
```

**Error responses:**
- 413: `{ error: { code: "FILE_TOO_LARGE" } }`
- 422: `{ error: { code: "INVALID_FILE_TYPE" } }` or `{ error: { code: "NO_FILE" } }`
- 403: `{ error: { code: "FORBIDDEN" } }`
- 404: `{ error: { code: "PUBLICATION_NOT_FOUND" } }`

### GET /api/publications/:pubId/import/:jobId/status

**Response 200:**
```json
{
  "success": true,
  "data": {
    "jobId": "string",
    "state": "waiting|active|completed|failed|delayed",
    "progress": 45,
    "result": { "imported": 980, "failed": 20, "errors": ["Invalid email: ..."] },
    "reason": null
  }
}
```

**Error responses:**
- 404: `{ error: { code: "JOB_NOT_FOUND" } }`
- 403: `{ error: { code: "FORBIDDEN" } }`

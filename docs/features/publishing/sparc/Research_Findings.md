# Research Findings — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## 1. Postmark Batch API Limit

**Finding**: Postmark's `sendEmailBatch` API accepts a maximum of **500 messages per API call**.

**Source**: Postmark official documentation — "Send Email Batch" endpoint.

**Current code**: `BATCH_SIZE = 1000` in `apps/api/src/routes/posts.ts:19`. Each BullMQ job payload contains up to 1000 recipients, and the worker calls `postmark.sendEmailBatch(messages)` with all 1000 in a single call. This violates the Postmark API limit.

**Impact**: Postmark will reject batches larger than 500 with an error. The worker's catch block rethrows this as a retriable error, causing all 5 retry attempts to fail. Subscribers in the second half of each batch (positions 501–1000) will never receive the email.

**Recommended fix**: Reduce `BATCH_SIZE` to 500 in `apps/api/src/routes/posts.ts` to align each BullMQ job with one Postmark API call. For a publication with 10,000 subscribers, this produces 20 BullMQ jobs (vs. 10 with BATCH_SIZE=1000), which is negligible overhead.

**Alternative** (if BATCH_SIZE=1000 is kept): split the `messages` array inside the worker into chunks of 500 and call `postmark.sendEmailBatch()` twice per job. This is more complex and the simpler option (BATCH_SIZE=500) is preferred.

---

## 2. Rich Text Editor Comparison (TipTap vs Quill vs Textarea)

**Context**: The current editor (`apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx`) uses a plain HTML `<textarea>` for `content_html`. Authors must write raw HTML.

**Comparison**:

| Option | Bundle Size | Pros | Cons |
|--------|------------|------|------|
| Raw `<textarea>` (current) | 0 KB additional | Zero dependency, works now | Poor UX, requires HTML knowledge |
| Quill | ~400 KB | Mature, good documentation | No longer actively maintained as of 2023, v2 delayed |
| TipTap | ~100–200 KB (tree-shakeable) | ProseMirror based, actively maintained, React/Next.js first-class support, extensible, outputs HTML | More complex setup than Quill |
| Lexical (Meta) | ~50–150 KB | Lightweight, framework-agnostic | Younger ecosystem, less documentation |

**Recommendation**:
- **MVP**: Textarea is acceptable. Authors can paste HTML or use a separate Markdown/HTML editor.
- **v1.0**: TipTap is the recommended choice. It has first-class Next.js support, outputs clean HTML compatible with the existing `content_html` storage and DOMPurify sanitization pipeline, and has an active maintenance track.
- TipTap's initial content can be loaded from `content_html` stored in the database without migration, making the transition from textarea non-breaking.

---

## 3. SEO Metadata Standards

**Finding**: Google's article structured data and Open Graph protocol have specific field requirements for newsletter content.

**Key constraints enforced by the current implementation** (`apps/web/src/app/[slug]/posts/[postSlug]/page.tsx:generateMetadata()`):
- `title`: truncated at 57 characters with `…` appended (total ≤ 60)
- `description`: uses `meta_description` if available (≤ 160 chars, validated at API), falls back to `subtitle.slice(0, 160)`, then a generated string
- `og:type = "article"` with `publishedTime` in ISO 8601 format
- `twitter:card = "summary_large_image"`
- `article:published_time` for Google Discover freshness ranking
- `alternates.canonical` pointing to the definitive URL

**Gap**: `published_at` is currently null for most sent posts (G3 bug). Google uses `article:published_time` for freshness ranking. Without it, sent posts appear as if published at `created_at`, which may be weeks earlier than the actual send date. This depresses freshness scores for posts sent soon after creation.

---

## 4. BullMQ Idempotency Pattern

**Finding**: BullMQ does not automatically deduplicate jobs with the same data. Two calls to `emailQueue.add()` with identical payloads create two jobs and cause double-sending.

**Current protection**:
- `POST /api/posts/:id/send` returns 409 if `post.status === 'sent'` — prevents UI-triggered duplicates.
- `EmailSend.createMany({ skipDuplicates: true })` — prevents duplicate EmailSend records.
- However, if the send endpoint is called twice concurrently before either request updates the post status, both could succeed (TOCTOU race condition).

**Recommendation**: Use a database-level pessimistic lock or a Redis `SET NX` guard keyed on `postId` before the send logic. For MVP, the 409 guard is sufficient given low concurrency.

---

## 5. Next.js 15 ISR for Public Posts

**Finding**: The public post page uses `revalidate: 300` (5-minute ISR cache) for `getPost()` and `getPublication()` calls.

**Implication**: A newly sent post may not appear at its public URL for up to 5 minutes after `POST /api/posts/:id/send` completes. This is acceptable for newsletter content where immediacy is not critical.

**For future**: Call `revalidatePath()` server-side after a successful send to immediately invalidate the ISR cache for that post's URL. Requires adding a revalidation API route or using Next.js on-demand revalidation.

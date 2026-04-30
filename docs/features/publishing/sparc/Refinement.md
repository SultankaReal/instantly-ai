# Refinement — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## 1. Edge Cases

### 1.1 Sending to 0 Subscribers

**Behavior**: `POST /api/posts/:id/send` with zero active subscribers is a valid no-op.

**Current implementation** (`apps/api/src/routes/posts.ts:424`): correctly detects `subscribers.length === 0`, updates status to `sent`, and returns `{ message: 'Post sent (0 active subscribers)', jobsQueued: 0 }`.

**Gap**: `published_at` is not set in this branch. After the G3 fix, it must also be applied here:
```typescript
data: { status: 'sent', sent_at: new Date(), published_at: post.published_at ?? new Date() }
```

**Test**: `GET /api/publications/:pubId/posts/:postSlug` must still return the post as public after a 0-subscriber send.

---

### 1.2 Re-Sending an Already-Sent Post

**Behavior**: `POST /api/posts/:id/send` returns 409 with `POST_ALREADY_SENT` when `post.status === 'sent'`.

**Current implementation** (`apps/api/src/routes/posts.ts:408`): implemented correctly.

**Risk**: A malicious or duplicate request (network retry) could double-enqueue. The 409 guard prevents this. `EmailSend.createMany({ skipDuplicates: true })` provides a second layer.

**Test scenario**: send POST twice; second request must return 409.

---

### 1.3 Draft Post Accessed by Public

**Behavior**: `GET /api/posts/:id` and the new `GET /api/publications/:pubId/posts/:postSlug` must return 404 for draft posts to unauthenticated users.

**Current implementation** (`apps/api/src/routes/posts.ts:245`): correctly returns 404 unless the requesting user is the author.

**New endpoint**: must replicate the same logic. The author may preview their own draft by including a valid JWT.

**Edge case**: a `scheduled` post is also not publicly visible until it is sent/published. The visibility check is `status === 'published' || status === 'sent'` only.

---

### 1.4 Paywall — 20% HTML Truncation

**Algorithm** (`apps/api/src/routes/posts.ts:49`): character-based truncation using `Math.ceil(html.length * 0.2)` then `slice(0, cutoff)`.

**Known limitation**: character-based truncation may cut in the middle of an HTML tag, producing malformed HTML (e.g., `<str` without closing `ong>`). For MVP this is acceptable. For v1.0, truncation should be DOM-aware (walk the tree, stop at 20% of text content, close all open tags).

**Document as tech debt**: the current implementation can render broken HTML in the paywall preview.

**Test**: a 10,000-character `content_html` must return exactly 2,000 characters (`Math.ceil(10000 * 0.2) = 2000`).

---

### 1.5 Autosave Race Condition

**Scenario**: User rapidly types, triggering multiple debounced save calls. If network is slow, two PATCH requests may be in-flight simultaneously.

**Current mitigation** (`apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx:97`): `useDebouncedCallback` with 30s delay means at most one request per 30 seconds of inactivity. The debounce resets on every keystroke, so concurrent in-flight requests are practically impossible under normal typing behavior.

**Risk**: User opens the editor in two browser tabs simultaneously. Changes in tab A may be overwritten by autosave from tab B.

**Mitigation**: Out of scope for MVP. Document as known limitation. Last-write-wins semantics are acceptable at this stage.

---

### 1.6 Large Content — No Size Limit

**Current state**: There is no server-side limit on `content_html` length. A 50MB HTML body would be accepted and stored.

**Risk**: PostgreSQL TEXT columns have no practical size limit, but large content degrades API response times and Postmark delivery.

**Recommendation**: Add Zod validation `z.string().max(500_000)` (500KB limit) on `content_html` in `CreatePostSchema` and `UpdatePostSchema`. Document as tech debt if not implemented for MVP.

---

### 1.7 `scheduled_at` in the Past

**Current state**: The API accepts any `scheduled_at` value including past dates. Setting a past `scheduled_at` sets `status = 'scheduled'` but no worker will ever trigger on it.

**Fix**: Add Zod `refine()` to `UpdatePostSchema`:
```typescript
scheduled_at: z.string().datetime().optional().refine(
  val => !val || new Date(val) > new Date(),
  { message: 'scheduled_at must be in the future' }
)
```

Return 400 with descriptive error message.

---

### 1.8 Slug Uniqueness on Create

**Current implementation** (`apps/api/src/routes/posts.ts:175`): while loop checks for slug collision and appends `-1`, `-2`, etc. until unique.

**Race condition**: two concurrent POST requests with the same title could both find the base slug available and both attempt to insert it. The `UNIQUE (publication_id, slug)` constraint will cause one to fail with a database unique constraint error.

**Mitigation for MVP**: Catch `P2002` (Prisma unique constraint error) in the create handler and retry slug generation. This is not currently implemented. Document as tech debt.

---

### 1.9 Delete Post with EmailSend Records

**Scenario**: A post has `status = 'draft'` but somehow has `EmailSend` records (e.g., from a failed send that partially created records before the status update).

**Behavior**: `DELETE /api/posts/:id` deletes the post. Prisma cascades the delete to `EmailSend` and `EmailEvent` records (via `onDelete: Cascade` in schema).

**Risk**: Analytics data is permanently lost. This is intentional for draft posts — they should not have EmailSend records in normal operation.

**Guard**: `DELETE` is only permitted when `status === 'draft'`. If the post is `sent` or `published`, return 409. This prevents accidental deletion of posts with meaningful delivery history.

---

## 2. Test Scenarios (Gherkin)

### Scenario 1: Send Post to Subscribers — Happy Path

```gherkin
Scenario: Send post to 2500 subscribers enqueues 3 BullMQ jobs
  Given publication "pub-123" has 2500 active subscribers
  And post "post-456" has status "draft" and belongs to "pub-123"
  And the author is authenticated
  When the author POSTs /api/posts/post-456/send
  Then the HTTP response status is 200
  And 2500 EmailSend records exist with status "queued"
  And 3 jobs are in the BullMQ queue "email:send-batch"
  And post "post-456" has status "sent"
  And post "post-456" has published_at set (not null)
  And post "post-456" has sent_at set (not null)
```

### Scenario 2: Expired Schedule

```gherkin
Scenario: Cannot schedule a post with a past datetime
  Given post "post-456" has status "draft"
  And the author is authenticated
  When the author PATCHes /api/posts/post-456 with scheduled_at "2020-01-01T00:00:00Z"
  Then the HTTP response status is 400
  And the error message contains "future"
```

### Scenario 3: Public Post Access with Paywall

```gherkin
Scenario: Paid post truncated at 20% for anonymous reader
  Given post "hello-world" is in publication "pub-123" with status "sent"
  And post "hello-world" has access "paid"
  And post content_html is exactly 10000 characters
  When an anonymous reader GETs /api/publications/pub-123/posts/hello-world
  Then the HTTP response status is 200
  And the response body content_html has length 2000
  And the response body field "truncated" is true
  And the response body field "upgrade_url" is not empty
```

### Scenario 4: Slug Collision

```gherkin
Scenario: Creating posts with identical titles generates unique slugs
  Given publication "pub-123" already has a post with slug "my-post"
  When the author creates a second post with title "My Post"
  Then the new post has slug "my-post-1"
  When the author creates a third post with title "My Post"
  Then the third post has slug "my-post-2"
```

### Scenario 5: Public Endpoint Returns 404 for Draft

```gherkin
Scenario: Draft post not visible at public URL
  Given post "hello-world" is in publication "pub-123" with status "draft"
  When an anonymous reader GETs /api/publications/pub-123/posts/hello-world
  Then the HTTP response status is 404
```

### Scenario 6: Worker Hard Bounce

```gherkin
Scenario: Postmark hard bounce marks subscriber as bounced
  Given a BullMQ job with postId "post-456" and recipient subscriber "sub-789"
  And Postmark returns ErrorCode 422 for subscriber "sub-789"
  When the email-send worker processes the job
  Then EmailSend for "sub-789" has status "failed"
  And subscriber "sub-789" has status "bounced"
```

---

## 3. Known Tech Debt

| Item | Risk | Priority |
|------|------|----------|
| Character-based HTML truncation can cut inside tags | Low (cosmetic) | v1.0 |
| No `content_html` size limit | Medium | Before production |
| Slug collision under concurrent creates (no `P2002` retry) | Low (race condition) | v1.0 |
| BATCH_SIZE=1000 exceeds Postmark 500-message limit | Medium | Before first large send |
| No backfill for `published_at` on already-sent posts | Low (historical SEO) | v1.0 |
| Last-write-wins semantics on concurrent editor sessions | Low | v1.0 |

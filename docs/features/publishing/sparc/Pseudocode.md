# Pseudocode — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

All algorithms reference the actual implementation files. TypeScript pseudocode uses the project's real type names from `@inkflow/shared-types`.

---

## 1. API Endpoint Contracts

### Existing Endpoints (accurate as of current code)

```
GET  /api/publications/:pubId/posts          → PostListResponse        (auth required)
POST /api/publications/:pubId/posts          → PostResponse            (auth required)
GET  /api/posts/:id                          → PostResponse | TruncatedPostResponse (optional auth)
PATCH /api/posts/:id                         → PostResponse            (auth required)
POST /api/posts/:id/send                     → { message, jobsQueued } (auth required)
GET  /api/posts/:id/analytics                → PostAnalyticsResponse   (auth required)
```

### New Endpoints to Implement

```
GET  /api/publications/:pubId/posts/:postSlug → PostResponse | TruncatedPostResponse (no auth)
DELETE /api/posts/:id                         → { success: true }       (auth required)
```

---

## 2. Core Algorithms

### 2.1 sendPost(postId, authorId)
**File**: `apps/api/src/routes/posts.ts` — `POST /api/posts/:id/send` handler

```typescript
async function sendPost(postId: string, authorId: string): Promise<SendResult> {
  // 1. Verify post exists and authorId owns it
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id, author_id, publication_id, status, published_at }
  })
  if (!post) throw new NotFoundError('POST_NOT_FOUND')
  if (post.author_id !== authorId) throw new ForbiddenError()
  if (post.status === 'sent') throw new ConflictError('POST_ALREADY_SENT')

  // 2. Fetch all active subscribers for the publication
  const subscribers = await prisma.subscriber.findMany({
    where: { publication_id: post.publication_id, status: 'active' },
    select: { id, email, name }
  })

  // 3. Handle zero-subscriber case
  if (subscribers.length === 0) {
    await prisma.post.update({
      where: { id: postId },
      data: {
        status: 'sent',
        sent_at: new Date(),
        published_at: post.published_at ?? new Date()  // G3 fix
      }
    })
    return { message: 'Post sent (0 active subscribers)', jobsQueued: 0 }
  }

  // 4. Create EmailSend records in bulk
  await prisma.emailSend.createMany({
    data: subscribers.map(s => ({
      post_id: postId,
      subscriber_id: s.id,
      status: 'queued',
      queued_at: new Date()
    })),
    skipDuplicates: true
  })

  // 5. Enqueue BullMQ jobs in batches of BATCH_SIZE (= 1000)
  //    app.emailQueue is a plugin-level singleton — NOT new Queue() here
  const batches = chunk(subscribers, BATCH_SIZE)
  for (const [index, batch] of batches.entries()) {
    const payload: EmailBatch = {
      postId,
      publicationId: post.publication_id,
      recipients: batch.map(s => ({ id: s.id, email: s.email, name: s.name })),
      batchNumber: index + 1,
      totalBatches: batches.length
    }
    await app.emailQueue.add(JOB_NAMES.SEND_EMAIL_BATCH, payload)
  }

  // 6. Update post status
  await prisma.post.update({
    where: { id: postId },
    data: {
      status: 'sent',
      sent_at: new Date(),
      published_at: post.published_at ?? new Date()  // G3 fix
    }
  })

  return {
    message: `Post queued for delivery to ${subscribers.length} subscribers`,
    jobsQueued: batches.length
  }
}
```

**Key changes from current code**:
- `app.emailQueue` singleton replaces `new Queue()` per request (G2 fix)
- `published_at: post.published_at ?? new Date()` added (G3 fix)

---

### 2.2 processEmailBatch(job)
**File**: `apps/worker/src/workers/email-send.worker.ts` — `processSendBatch()`

```typescript
async function processEmailBatch(job: Job<EmailBatch>): Promise<void> {
  const { postId, recipients, publicationId } = job.data

  // 1. Fetch post title and publication name for email content
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: { title, content_html, publication: { select: { name } } }
  })

  // 2. Build Postmark message array (max 500 per Postmark API call)
  const messages = recipients.map(r => ({
    From: `${post.publication.name} <${POSTMARK_FROM_EMAIL}>`,
    To: r.email,
    Subject: post.title,
    HtmlBody: post.content_html,
    TrackOpens: true,
    TrackLinks: 'HtmlAndText',
    MessageStream: 'outbound',
    Tag: `post-${postId}`,
    Metadata: { postId, subscriberId: r.id, publicationId }
  }))

  // 3. Send batch via Postmark (may throw on network/5xx → BullMQ retries)
  const results = await postmark.sendEmailBatch(messages)

  // 4. Process per-message results
  for (const [i, result] of results.entries()) {
    const recipient = recipients[i]
    if (!result || !recipient) continue

    if (result.ErrorCode === 0) {
      // Success: mark as sent, store Postmark message ID
      await prisma.emailSend.updateMany({
        where: { post_id: postId, subscriber_id: recipient.id },
        data: { status: 'sent', postmark_message_id: result.MessageID, sent_at: new Date() }
      })
    } else {
      // Failure: mark as failed
      await prisma.emailSend.updateMany({
        where: { post_id: postId, subscriber_id: recipient.id },
        data: { status: 'failed', failed_at: new Date(), error_details: { errorCode: result.ErrorCode, message: result.Message } }
      })

      // Hard bounce (Postmark codes 400–499) → mark subscriber as bounced
      if (result.ErrorCode >= 400 && result.ErrorCode < 500) {
        await prisma.subscriber.updateMany({
          where: { id: recipient.id, publication_id: publicationId },
          data: { status: 'bounced' }
        })
      }
    }
  }
}
```

---

### 2.3 autosavePost(postId, patch)
**File**: `apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx`

```typescript
// Debounce wrapper — fires 30_000ms after last call
const debouncedSave = useDebouncedCallback(savePost, 30_000)

async function savePost(patch: Partial<UpdatePostBody>): Promise<void> {
  const token = getStoredToken()
  if (!token) return

  setSaveStatus('saving')
  try {
    await apiClient.patch(`/api/posts/${postId}`, patch, { token })
    setSaveStatus('saved')
    setLastSavedAt(new Date())
  } catch {
    setSaveStatus('error')
  }
}

// On every field change, call debouncedSave with current state snapshot
function handleFieldChange(field: string, value: string): void {
  setState(prev => ({ ...prev, [field]: value }))
  setSaveStatus('idle')
  debouncedSave({ ...currentState, [field]: value })
}
```

**Invariant**: Only one pending debounce timer exists at a time. Each field change resets the timer. The full state snapshot is passed on every call to avoid stale closures.

---

### 2.4 generateSEOMetadata(post, publication)
**File**: `apps/web/src/app/[slug]/posts/[postSlug]/page.tsx` — `generateMetadata()`

```typescript
function generateSEOMetadata(post: PostContent, pub: PublicationResponse): Metadata {
  // Title: truncate at 57 chars, append ellipsis if needed (total ≤60)
  const title = post.title.length > 57
    ? `${post.title.slice(0, 57)}…`
    : post.title

  // Description: prefer meta_description, fall back to subtitle, then generated
  const description = post.meta_description
    ? post.meta_description          // already ≤160 chars (validated at API)
    : post.subtitle
      ? post.subtitle.slice(0, 160)
      : `Read "${post.title}" on ${pub.name}`

  const canonicalUrl = post.canonical_url
    ?? `${process.env.NEXT_PUBLIC_APP_URL}/${pub.slug}/posts/${post.slug}`

  const publishedAt = post.published_at
    ? new Date(post.published_at).toISOString()
    : new Date(post.created_at).toISOString()

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime: publishedAt,  // ISO 8601
      siteName: pub.name,
      url: canonicalUrl
    },
    twitter: { card: 'summary_large_image', title, description },
    other: {
      'article:author': pub.name,
      'article:published_time': publishedAt
    }
  }
}
```

---

### 2.5 publishPost(postId, authorId)
**New endpoint**: `PATCH /api/posts/:id` with `{ status: 'published' }` in the body.

```typescript
// Note: publishPost is handled by the existing PATCH /api/posts/:id endpoint.
// The status field needs to be added to UpdatePostSchema.
// published_at must be set server-side when status transitions to 'published'.

async function handlePatchPost(postId: string, authorId: string, body: UpdatePostBody): Promise<PostResponse> {
  const post = await verifyOwnership(postId, authorId)

  const updateData: Prisma.PostUpdateInput = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
    ...(body.content_html !== undefined && { content_html: sanitizeHtml(body.content_html) }),
    ...(body.access !== undefined && { access: body.access }),
    ...(body.meta_description !== undefined && { meta_description: body.meta_description }),
    ...(body.scheduled_at !== undefined && {
      scheduled_at: body.scheduled_at,
      status: 'scheduled'
    }),
    // Set published_at when transitioning to 'published'
    ...(body.status === 'published' && {
      status: 'published',
      published_at: post.published_at ?? new Date()
    })
  }

  return prisma.post.update({ where: { id: postId }, data: updateData, include: { publication: ... } })
}
```

---

### 2.6 getPostBySlug(pubId, postSlug)
**New endpoint**: `GET /api/publications/:pubId/posts/:postSlug`

```typescript
async function getPostBySlug(
  pubId: string,
  postSlug: string,
  userId: string | null
): Promise<PostResponse | TruncatedPostResponse> {
  // 1. Verify publication exists
  const publication = await prisma.publication.findUnique({
    where: { id: pubId },
    select: { id: true }
  })
  if (!publication) throw new NotFoundError('PUBLICATION_NOT_FOUND')

  // 2. Look up post by composite key (publication_id + slug)
  const post = await prisma.post.findUnique({
    where: { publication_id_slug: { publication_id: pubId, slug: postSlug } },
    include: { publication: { select: { id, name, slug } } }
  })
  if (!post) throw new NotFoundError('POST_NOT_FOUND')

  // 3. Visibility check: only published or sent posts are public
  if (post.status !== 'published' && post.status !== 'sent') {
    // Author can preview their own draft
    if (!userId || userId !== post.author_id) throw new NotFoundError('POST_NOT_FOUND')
  }

  // 4. Apply paywall (identical logic to GET /api/posts/:id)
  return applyPaywall(post, userId)
}

// Shared paywall helper (extracted to avoid duplication with GET /api/posts/:id)
async function applyPaywall(
  post: PostWithPublication,
  userId: string | null
): Promise<PostResponse | TruncatedPostResponse> {
  if (post.access !== 'paid') return post

  const hasAccess = await checkPaidAccess(post, userId)
  if (hasAccess) return post

  return {
    ...post,
    content_html: truncateHtmlTo20Percent(post.content_html),
    truncated: true,
    upgrade_url: `/publications/${post.publication.slug}/subscribe`
  }
}
```

---

### 2.7 deletePost(postId, authorId)
**New endpoint**: `DELETE /api/posts/:id`

```typescript
async function deletePost(postId: string, authorId: string): Promise<void> {
  // 1. Verify existence and ownership
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id, author_id, status }
  })
  if (!post) throw new NotFoundError('POST_NOT_FOUND')
  if (post.author_id !== authorId) throw new ForbiddenError()

  // 2. Guard: only allow deletion of draft posts
  if (post.status !== 'draft') {
    throw new ConflictError('POST_ALREADY_SENT',
      'Only draft posts can be deleted. Sent posts are retained for analytics.')
  }

  // 3. Delete post (EmailSend records cascade via Prisma schema onDelete: Cascade)
  await prisma.post.delete({ where: { id: postId } })
}
```

**Note**: Cascade deletion of `EmailSend` records on draft deletion is safe because draft posts have no `EmailSend` records (they are created only in `sendPost`). If a draft somehow has orphaned `EmailSend` records, they cascade-delete. This is documented as acceptable data loss in Refinement.md.

---

## 3. Queue Singleton Plugin
**New file**: `apps/api/src/plugins/email-queue.plugin.ts`

```typescript
import fp from 'fastify-plugin'
import { Queue } from 'bullmq'
import { QUEUE_NAMES } from '@inkflow/shared-types'

declare module 'fastify' {
  interface FastifyInstance {
    emailQueue: Queue
  }
}

export const emailQueuePlugin = fp(async (app) => {
  const emailQueue = new Queue(QUEUE_NAMES.EMAIL_SEND, {
    connection: app.redis,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200
    }
  })

  app.decorate('emailQueue', emailQueue)

  app.addHook('onClose', async () => {
    await emailQueue.close()
  })
})
```

Registration in `apps/api/src/app.ts` (or server entry point):
```typescript
await app.register(emailQueuePlugin)  // after redis plugin
await app.register(postRoutes)         // uses app.emailQueue
```

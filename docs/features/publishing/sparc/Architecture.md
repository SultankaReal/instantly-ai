# Architecture — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## 1. System Context

Publishing sits at the intersection of three services in the monorepo:

```
apps/
  api/     — Fastify REST API  (creates posts, triggers email send)
  web/     — Next.js 15 App Router  (editor UI, public post page)
  worker/  — BullMQ workers  (email delivery to Postmark)
packages/
  shared-types/  — EmailBatch, QUEUE_NAMES, JOB_NAMES, PostResponse types
```

---

## 2. Data Flow — Send Post

```
Author (browser)
    │
    │  POST /api/posts/:id/send
    ▼
┌─────────────────────────────────────────────┐
│  Fastify API  (apps/api/src/routes/posts.ts) │
│                                              │
│  1. Verify ownership                         │
│  2. Fetch active subscribers                 │
│  3. prisma.emailSend.createMany()            │
│  4. app.emailQueue.add() × N batches        │
│  5. prisma.post.update(status=sent)          │
└───────────────┬─────────────────────────────┘
                │  BullMQ jobs (email:send-batch)
                ▼
┌──────────────────────────────────────────────┐
│  Redis 7  (queue persistence)                │
└───────────────┬──────────────────────────────┘
                │  Worker polls queue (concurrency=10)
                ▼
┌──────────────────────────────────────────────┐
│  BullMQ Worker  (apps/worker/src/workers/    │
│  email-send.worker.ts)                       │
│                                              │
│  processSendBatch():                         │
│  1. Fetch post + publication from Prisma     │
│  2. Build Postmark message array             │
│  3. postmark.sendEmailBatch()                │
│  4. Update EmailSend status per result       │
│  5. On hard bounce → subscriber.status=bounced│
└───────────────┬──────────────────────────────┘
                │  HTTPS batch API
                ▼
         Postmark (external)
```

---

## 3. Data Flow — Public Post Read

```
Reader (browser or crawler)
    │
    │  GET /:pubSlug/posts/:postSlug
    ▼
┌──────────────────────────────────────────────┐
│  Next.js App Router (Server Component)       │
│  apps/web/src/app/[slug]/posts/[postSlug]/   │
│  page.tsx                                    │
│                                              │
│  1. getPublication(slug)                     │
│       → GET /api/publications/:slug          │
│  2. getPost(pub.id, postSlug)                │
│       → GET /api/publications/:pubId/posts/  │
│               :postSlug  (NEW ENDPOINT)      │
│  3. generateMetadata() for SEO               │
│  4. Render article with paywall UI if needed │
└───────────────┬──────────────────────────────┘
                │  Internal fetch (server-side, revalidate=300s)
                ▼
┌──────────────────────────────────────────────┐
│  Fastify API                                 │
│  GET /api/publications/:pubId/posts/:postSlug│
│                                              │
│  1. Verify publication exists                │
│  2. findUnique by { publication_id, slug }   │
│  3. Visibility check (published/sent only)   │
│  4. applyPaywall() → full or 20% truncated   │
└───────────────┬──────────────────────────────┘
                │  Prisma query
                ▼
         PostgreSQL 16
```

---

## 4. Queue Architecture

### Queue Name Convention
```
QUEUE_NAMES.EMAIL_SEND = 'email:send-batch'
```
Defined in `packages/shared-types/src/queue/index.ts`.

### Singleton Pattern (G2 fix)

The `Queue` instance is registered once at API server startup via a Fastify plugin:

```
apps/api/src/plugins/email-queue.plugin.ts
  └── registers app.emailQueue (Queue instance)
  └── app.addHook('onClose') → emailQueue.close()

apps/api/src/routes/posts.ts
  └── POST /api/posts/:id/send
      └── uses app.emailQueue.add()  (NO new Queue() here)
```

The worker (`apps/worker/src/workers/email-send.worker.ts`) creates its own `Worker` instance (separate process, separate Redis connection), which is correct — Worker and Queue are different objects.

### Batch Size Rationale

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `BATCH_SIZE` in posts.ts | 1000 | Number of EmailSend records per BullMQ job |
| Postmark `sendEmailBatch` limit | 500 messages per API call | Postmark documented limit |
| Current risk | Medium | Current code sends 1000 messages per Postmark call, exceeding the limit |

**Recommended action**: Set `BATCH_SIZE = 500` in `apps/api/src/routes/posts.ts:19` to align with Postmark's batch API limit. Changing BATCH_SIZE from 1000 to 500 doubles the number of BullMQ jobs but guarantees Postmark accepts every batch. See Research_Findings.md for details.

### BullMQ Job Options
```typescript
defaultJobOptions: {
  attempts: 5,
  backoff: { type: 'exponential', delay: 2000 },  // 2s, 4s, 8s, 16s, 32s
  removeOnComplete: 100,  // retain last 100 completed jobs for inspection
  removeOnFail: 200       // retain last 200 failed jobs for debugging
}
```

---

## 5. Database Schema (Relevant Tables)

```sql
-- Post
Post {
  id              UUID PRIMARY KEY
  publication_id  UUID REFERENCES Publication(id) ON DELETE CASCADE
  author_id       UUID REFERENCES User(id)
  title           TEXT NOT NULL
  subtitle        TEXT
  content_html    TEXT NOT NULL           -- DOMPurify sanitized before storage
  slug            TEXT NOT NULL
  status          TEXT  -- 'draft' | 'scheduled' | 'sent' | 'published'
  access          TEXT  -- 'free' | 'paid'
  meta_description TEXT                  -- ≤160 chars
  canonical_url   TEXT
  scheduled_at    TIMESTAMPTZ
  sent_at         TIMESTAMPTZ
  published_at    TIMESTAMPTZ             -- set on send OR on explicit publish action
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ

  UNIQUE (publication_id, slug)           -- enables slug lookup
}

-- EmailSend (one record per recipient per post)
EmailSend {
  id                  UUID PRIMARY KEY
  post_id             UUID REFERENCES Post(id) ON DELETE CASCADE
  subscriber_id       UUID REFERENCES Subscriber(id)
  postmark_message_id TEXT
  status              TEXT  -- 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed'
  queued_at           TIMESTAMPTZ
  sent_at             TIMESTAMPTZ
  failed_at           TIMESTAMPTZ
  error_details       JSONB
}

-- EmailEvent (open/click/bounce events from Postmark webhook)
EmailEvent {
  id             UUID PRIMARY KEY
  email_send_id  UUID REFERENCES EmailSend(id) ON DELETE CASCADE
  event_type     TEXT  -- 'open' | 'click' | 'bounce' | 'spam_complaint'
  link_url       TEXT
  user_agent     TEXT
  occurred_at    TIMESTAMPTZ
}
```

---

## 6. File Map — Publishing Feature

```
apps/api/src/
  plugins/
    email-queue.plugin.ts    ← NEW: Queue singleton (G2 fix)
  routes/
    posts.ts                 ← MODIFY: add GET /:pubId/posts/:postSlug, DELETE /:id,
                                        use app.emailQueue, set published_at (G1, G2, G3, G7)

apps/web/src/app/
  (dashboard)/dashboard/posts/
    [id]/page.tsx            ← MODIFY: add meta_description, scheduled_at, preview button,
                                        delete button (G4, G5, G6, G7 UI)
  [slug]/posts/[postSlug]/
    page.tsx                 ← No changes needed — already calls correct endpoint

apps/worker/src/workers/
  email-send.worker.ts       ← No changes needed for gap fixes
```

---

## 7. Nginx Routing

Publishing does not require Nginx changes. Existing upstream rules route all `/api/*` to `:3000` (Fastify) and all other paths to `:3001` (Next.js). The new public post path `/:slug/posts/:postSlug` is a Next.js App Router catch-all and is handled by the existing `[slug]/posts/[postSlug]` route segment.

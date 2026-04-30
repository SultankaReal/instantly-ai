# Solution Strategy — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## 1. SCQA Analysis

### Situation
Inkflow's publishing feature has a functional skeleton: posts can be created, edited, and saved. The email delivery pipeline (BullMQ + Postmark + worker) is implemented and tested. The public-facing post page and editor UI exist.

### Complication
Seven gaps prevent the publishing feature from being used in production:
1. The public post page (`[slug]/posts/[postSlug]/page.tsx`) calls `GET /api/publications/:pubId/posts/:postSlug` — an endpoint that does not exist. Every reader who follows a link to a published post receives a 404.
2. `POST /api/posts/:id/send` creates a `new Queue()` per request and immediately calls `emailQueue.close()`. Under load this creates hundreds of Redis connections and closes them before jobs complete, causing dropped jobs and resource exhaustion.
3. `published_at` is never set, so the SEO metadata on the public page falls back to `created_at`, causing inaccurate article timestamps for crawlers.
4. The editor has no `scheduled_at` datetime picker, no `meta_description` field, no preview link, and no delete action.

### Question
How do we close these gaps with minimal surface area changes while preserving existing behavior?

### Answer
Fix the two critical server-side bugs first (G1, G2), then set `published_at` correctly (G3), then add the four missing UI components to the existing editor page (G4–G7). No architectural changes are required — the fixes integrate into the existing Fastify plugin and Next.js page structure.

---

## 2. First Principles Analysis

### Why G1 (missing slug endpoint) is the most critical gap
The public post URL is `/:pubSlug/posts/:postSlug`. The web page resolves the publication by slug, then fetches the post by `publicationId + postSlug`. The existing `GET /api/posts/:id` only accepts a UUID and cannot serve slug-based lookups. Without this endpoint, the entire public reading experience is broken — authors cannot share links, SEO cannot be indexed.

**Resolution**: Add `GET /api/publications/:pubId/posts/:postSlug` that looks up by `{ publication_id: pubId, slug: postSlug }`, applies identical paywall logic to the existing `GET /api/posts/:id`, and returns the same response shape.

### Why G2 (queue singleton) is a reliability bug
BullMQ `Queue` objects maintain a persistent Redis connection pool. Creating one per HTTP request means:
- Each send request adds N connections to Redis (where N = pool size)
- `emailQueue.close()` is called immediately after `emailQueue.add()`, potentially before the job is durably written
- Under concurrent sends (scheduled worker trigger + manual trigger race), Redis connection count spikes

**Resolution (TRIZ #10 — Prior Action)**: Register a single `Queue` instance as a Fastify plugin at startup. The plugin decorates `app.emailQueue`. The send route uses `app.emailQueue.add()`. No per-request lifecycle management.

### Why G3 (published_at) matters for SEO
The public post page uses `post.published_at` for the OG `publishedTime` and `article:published_time` structured data fields. Google uses these for freshness ranking. A post sent in May 2026 but showing a January creation date misrepresents recency. The fix is a single line in the send handler: `published_at: post.published_at ?? new Date()`.

---

## 3. TRIZ Resolutions

### G2 — Queue Singleton (TRIZ #10: Prior Action)
**Problem**: Queue instance created per request (harmful action timed with the useful action).
**Contradiction**: We need a Queue connection available for every request, but opening one per request wastes resources.
**TRIZ #10 (Prior Action)**: Perform the useful action before it is needed. Register the Queue singleton in a Fastify plugin during server startup, so it is available to every route handler without per-request cost.

### G1 — Routing Gap (TRIZ #1: Segmentation)
**Problem**: One endpoint (`GET /api/posts/:id`) handles UUID lookups; slug lookups have no handler.
**Contradiction**: We want a single endpoint, but the lookup key differs.
**TRIZ #1 (Segmentation)**: Separate the lookup concerns. Keep `GET /api/posts/:id` for internal UUID lookups (editor). Add `GET /api/publications/:pubId/posts/:postSlug` for slug lookups (public reader). The paywall logic is extracted into a shared `applyPaywall()` helper used by both routes.

---

## 4. Risk Table

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Queue close() drops in-flight jobs | High (bug is present now) | High: lost emails | Fix G2 immediately; test with real Redis |
| Slug collision on public endpoint if pubId is wrong | Low | Medium: 404 for reader | Endpoint validates publication exists before slug lookup |
| `published_at` backfill needed for existing sent posts | Low | Low: historical SEO only | One-off migration script (out of scope, document as known gap) |
| Postmark batch > 500 messages per API call | Medium | Medium: partial delivery | Document BATCH_SIZE=1000 as tech debt; Postmark silently rejects excess |
| `DELETE` cascade on EmailSend records with events | Medium | High: data loss | Guard delete to draft-only posts; document cascading risk |
| scheduled_at in the past accepted by API | Medium | Low: post never sent | Add Zod `refine()` validation: `scheduled_at > now()` |
| TipTap replacement breaks existing HTML content | N/A (v1.0) | Medium | Textarea content is valid HTML; TipTap can load it as initial content |

---

## 5. Implementation Order

1. **G2** — Queue singleton plugin (prevents resource leak, lowest risk to implement)
2. **G1** — Public slug endpoint (unblocks the entire public reading experience)
3. **G3** — Set `published_at` on send (1-line fix in send handler)
4. **G7** — `DELETE /api/posts/:id` + delete button in posts list UI
5. **G5** — Add `meta_description` input to editor
6. **G4** — Add `scheduled_at` datetime picker to editor
7. **G6** — Add preview button to editor (simplest, last)

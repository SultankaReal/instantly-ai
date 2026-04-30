# PRD — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01 | Status: Implementation Ready

---

## 1. Problem Statement

The publishing feature is the core value-delivery mechanism of Inkflow. Authors must be able to write, schedule, and send posts to subscribers. A partial implementation exists; however, critical gaps prevent the public reading experience from functioning and introduce a resource-leak bug in the email send path. This document scopes the work needed to reach a complete, production-ready publishing feature.

---

## 2. Scope

### 2.1 What Exists (Do Not Re-Implement)

| Component | Location | Status |
|-----------|----------|--------|
| `GET /api/publications/:pubId/posts` | `apps/api/src/routes/posts.ts:57` | Done |
| `POST /api/publications/:pubId/posts` | `apps/api/src/routes/posts.ts:133` | Done |
| `GET /api/posts/:id` | `apps/api/src/routes/posts.ts:214` | Done |
| `PATCH /api/posts/:id` | `apps/api/src/routes/posts.ts:302` | Done |
| `POST /api/posts/:id/send` | `apps/api/src/routes/posts.ts:371` | Done (has queue leak bug) |
| `GET /api/posts/:id/analytics` | `apps/api/src/routes/posts.ts:504` | Done |
| Email send worker | `apps/worker/src/workers/email-send.worker.ts` | Done |
| Posts list page | `apps/web/src/app/(dashboard)/dashboard/posts/page.tsx` | Done |
| New post page | `apps/web/src/app/(dashboard)/dashboard/posts/new/page.tsx` | Done |
| Post editor page | `apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx` | Done (missing fields) |
| Public post page | `apps/web/src/app/[slug]/posts/[postSlug]/page.tsx` | Done (calls missing endpoint) |
| Post DB schema | Prisma `Post`, `EmailSend`, `EmailEvent` models | Done |
| DOMPurify sanitization | `apps/api/src/routes/posts.ts:21` | Done |
| Paywall truncation (20%) | `apps/api/src/routes/posts.ts:49` | Done |
| Slug collision resolution | `apps/api/src/routes/posts.ts:175` | Done |
| 409 re-send guard | `apps/api/src/routes/posts.ts:408` | Done |
| 30s autosave with debounce | `apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx:97` | Done |

### 2.2 What Is Missing (Deliverables)

| # | Gap | Severity | Layer |
|---|-----|----------|-------|
| G1 | `GET /api/publications/:pubId/posts/:postSlug` endpoint does not exist | Critical | API |
| G2 | Queue singleton bug: `new Queue()` + `emailQueue.close()` per request in `POST /api/posts/:id/send` | Critical | API |
| G3 | `published_at` never set when sending a post | High | API |
| G4 | Schedule UI: datetime picker for `scheduled_at` missing from editor | Medium | Web |
| G5 | Meta description field missing from editor UI | Medium | Web |
| G6 | Preview button missing from editor (opens public post URL in new tab) | Low | Web |
| G7 | Delete post: no `DELETE /api/posts/:id` endpoint and no UI | Medium | API + Web |

---

## 3. User Stories

| ID | Story | MVP | v1.0 |
|----|-------|-----|------|
| US-01 | Create and save a post draft | Yes | — |
| US-02 | Publish post publicly (without emailing) | Yes | — |
| US-03 | Send post to all subscribers via email | Yes | — |
| US-04 | Schedule post for future sending | Yes | — |
| US-05 | View published post publicly with full SEO | Yes | — |
| US-06 | Delete a draft post | Yes | — |
| US-07 | Preview post before sending | — | Yes |
| US-08 | WYSIWYG rich text editor (TipTap) | — | Yes |

---

## 4. Feature Matrix

| Capability | MVP | v1.0 |
|------------|-----|------|
| HTML textarea editor | Yes | Deprecated by TipTap |
| TipTap rich text editor | No | Yes |
| Autosave (30s debounce) | Yes | Yes |
| Scheduling (`scheduled_at`) | Yes | Yes |
| Send to subscribers (BullMQ) | Yes | Yes |
| Paywall (20% truncation, server-side) | Yes | Yes |
| Public post page with SEO | Yes | Yes |
| Delete draft | Yes | Yes |
| Preview button | Yes | Yes |
| Meta description input | Yes | Yes |
| AI writing assistant | No | Yes |

---

## 5. Non-Functional Requirements

- **Autosave latency**: UI debounce fires 30 seconds after last keystroke; PATCH completes < 500ms
- **Send throughput**: 1000 EmailSend records created per batch in BullMQ; worker concurrency = 10
- **Postmark batch limit**: 500 messages per API call (document batch size as tech debt if current BATCH_SIZE=1000 exceeds this)
- **Paywall**: content truncation is character-based, applied server-side before response
- **HTML safety**: DOMPurify applied on every write (`POST` and `PATCH content_html`)
- **SEO**: title ≤ 60 chars, meta_description ≤ 160 chars, OG + Twitter + Article schema on public post page
- **Queue**: the BullMQ Queue instance MUST be a plugin-level singleton — never created per request

---

## 6. Out of Scope for This Document

- Subscriber management (separate feature)
- Stripe payments / paid subscriber access control (separate feature)
- AI writing assistant (v1.0)
- Image uploads / MinIO integration
- Substack import

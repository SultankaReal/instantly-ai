# Final Summary — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## What Exists

The publishing feature has a solid foundation. The following are fully implemented and do not require changes:

- **API** (`apps/api/src/routes/posts.ts`): CRUD for posts, paginated list, send-to-subscribers, analytics. DOMPurify HTML sanitization, slug generation with collision resolution, paywall truncation, 409 guard against re-sending.
- **Worker** (`apps/worker/src/workers/email-send.worker.ts`): BullMQ consumer on `email:send-batch`, Postmark batch delivery, hard bounce detection, structured logging.
- **Web Editor** (`apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx`): 30-second debounced autosave, send button with confirmation, save status indicator, access toggle.
- **Public Post Page** (`apps/web/src/app/[slug]/posts/[postSlug]/page.tsx`): Full SEO metadata generation (OG, Twitter, Article schema), paywall UI with upgrade CTA.
- **Database**: `Post`, `EmailSend`, `EmailEvent` Prisma models with correct foreign keys and `UNIQUE (publication_id, slug)` index.

---

## The 7 Gaps

| # | Gap | Severity | Files Affected |
|---|-----|----------|---------------|
| G1 | Missing public endpoint: `GET /api/publications/:pubId/posts/:postSlug` | **Critical** | `apps/api/src/routes/posts.ts` |
| G2 | Queue singleton bug: `new Queue()` + `emailQueue.close()` per HTTP request | **Critical** | `apps/api/src/routes/posts.ts`, new `apps/api/src/plugins/email-queue.plugin.ts` |
| G3 | `published_at` never set when sending a post | **High** | `apps/api/src/routes/posts.ts` (2 locations in send handler) |
| G4 | No `scheduled_at` datetime picker in editor UI | **Medium** | `apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx` |
| G5 | No `meta_description` input in editor UI | **Medium** | `apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx` |
| G6 | No preview button in editor | **Low** | `apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx` |
| G7 | No `DELETE /api/posts/:id` endpoint and no delete UI | **Medium** | `apps/api/src/routes/posts.ts`, `apps/web/src/app/(dashboard)/dashboard/posts/[id]/page.tsx` |

---

## Implementation Order (Most Critical First)

### Phase 1 — Server-Side Fixes (Blocking for Production)

**Step 1: G2 — Queue Singleton Plugin**
- Create `apps/api/src/plugins/email-queue.plugin.ts`
- Register `app.emailQueue` as Fastify decorator with proper `onClose` lifecycle
- Remove `new Queue()` and `emailQueue.close()` from `POST /api/posts/:id/send`
- Replace with `app.emailQueue.add()`
- Commit: `fix(api): move BullMQ Queue to plugin-level singleton`

**Step 2: G1 — Public Slug Endpoint**
- Add `GET /api/publications/:pubId/posts/:postSlug` route to `apps/api/src/routes/posts.ts`
- Reuse shared `applyPaywall()` helper (extract from existing `GET /api/posts/:id` handler)
- Visibility check: `status === 'published' || status === 'sent'` only
- Author preview: if JWT present and `userId === post.author_id`, allow draft access
- Commit: `feat(api): add public post-by-slug endpoint`

**Step 3: G3 — Set published_at**
- In `POST /api/posts/:id/send` handler (both zero-subscriber and normal paths), add:
  `published_at: post.published_at ?? new Date()`
- Run SQL backfill for existing sent posts: `UPDATE posts SET published_at = sent_at WHERE status = 'sent' AND published_at IS NULL`
- Commit: `fix(api): set published_at when sending a post`

### Phase 2 — API Completeness

**Step 4: G7 — Delete Endpoint**
- Add `DELETE /api/posts/:id` to `apps/api/src/routes/posts.ts`
- Guard: `status === 'draft'` only; return 409 for sent/published posts
- Prisma cascade handles `EmailSend` records
- Commit: `feat(api): add DELETE /api/posts/:id for draft posts`

### Phase 3 — Editor UI Gaps

**Step 5: G5 — Meta Description Input**
- Add `<textarea>` or `<input>` for `meta_description` to editor form
- Validation hint: ≤ 160 characters
- Wire to `debouncedSave` with current state
- Commit: `feat(web): add meta_description field to post editor`

**Step 6: G4 — Schedule UI**
- Add `<input type="datetime-local">` for `scheduled_at` to editor form
- Min value: current datetime (prevent past scheduling in UI — API also validates)
- Wire to `PATCH /api/posts/:id` via `debouncedSave`
- Commit: `feat(web): add schedule datetime picker to post editor`

**Step 7: G6 — Preview Button**
- Add "Preview" button to editor action bar
- If `post.status === 'sent' || post.status === 'published'`: `window.open(`/${pubSlug}/posts/${post.slug}`, '_blank')`
- If `post.status === 'draft'`: button disabled with tooltip "Publish or send first"
- Commit: `feat(web): add preview button to post editor`

**Step 8: G7 (UI) — Delete Button**
- Add "Delete" button to editor for drafts only (hidden when `status !== 'draft'`)
- Confirm dialog, then `DELETE /api/posts/:id`, redirect to `/dashboard/posts` on success
- Commit: `feat(web): add delete post button to editor`

---

## Additional Finding: BATCH_SIZE Must Be 500

The current `BATCH_SIZE = 1000` in `apps/api/src/routes/posts.ts:19` exceeds Postmark's 500-message-per-batch API limit. This will cause every second half of a batch to be rejected silently. **Change to 500 before the first production send.** See Research_Findings.md for full analysis.

---

## Risk Summary

| Risk | Mitigation |
|------|-----------|
| G1 unresolved: all public post URLs 404 | Implement immediately — blocked on this |
| G2 unresolved: Redis connection exhaustion under load | Implement before any scaled send |
| BATCH_SIZE=1000 causes Postmark rejection | Change to 500 before production |
| `published_at` null: SEO freshness penalty | Fix G3 + run backfill SQL |
| scheduled_at in the past accepted | Add Zod refine validation |

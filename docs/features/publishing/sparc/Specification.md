# Specification — Publishing Feature
**Inkflow Newsletter Platform**
Version: 1.0 | Date: 2026-05-01

---

## 1. User Stories

### US-01: Create and Save a Post (Draft)

**As an** author,
**I want to** create a new post and have it auto-saved as I type,
**So that** I never lose work in progress.

**Acceptance Criteria:**

```gherkin
Feature: Create and save a draft post

  Background:
    Given I am authenticated as an author
    And I own a publication with id "pub-123"

  Scenario: Successfully create a new draft
    When I POST /api/publications/pub-123/posts with:
      | title        | "Hello World"          |
      | content_html | "<p>My first post</p>" |
      | access       | "free"                 |
    Then the response status is 201
    And the response contains a post with status "draft"
    And the post has a slug derived from the title (e.g. "hello-world")
    And the content_html is DOMPurify-sanitized before storage

  Scenario: Slug collision resolution
    Given a post with slug "hello-world" already exists in publication "pub-123"
    When I POST /api/publications/pub-123/posts with title "Hello World"
    Then the new post has slug "hello-world-1"

  Scenario: Autosave after 30 seconds of inactivity
    Given I have the editor open for post "post-456"
    When I type in the title field
    And 30 seconds pass with no further changes
    Then PATCH /api/posts/post-456 is called with the updated title
    And the UI shows "Saved Ns ago"

  Scenario: Access control on create
    Given I am authenticated as "other-author"
    When I POST /api/publications/pub-123/posts
    Then the response status is 403
```

---

### US-02: Publish Post Publicly (Without Emailing)

**As an** author,
**I want to** set a post to published status so it's visible at its public URL,
**So that** I can publish without sending an email blast.

**Acceptance Criteria:**

```gherkin
Feature: Publish post publicly

  Scenario: Author publishes a draft post
    Given I am authenticated as the author of post "post-456" with status "draft"
    When I PATCH /api/posts/post-456 with:
      | status | "published" |
    Then the response status is 200
    And post.status is "published"
    And post.published_at is set to now (within 5 seconds of the request)

  Scenario: Published post visible at public URL
    Given post "post-456" has status "published"
    When a reader visits GET /api/publications/pub-123/posts/hello-world (no auth)
    Then the response status is 200
    And the full content is returned (if access is "free")

  Scenario: Draft post not accessible to public
    Given post "post-456" has status "draft"
    When a reader (unauthenticated) requests GET /api/publications/pub-123/posts/hello-world
    Then the response status is 404
```

---

### US-03: Send Post to Subscribers (Email Batch)

**As an** author,
**I want to** send a post to all active subscribers,
**So that** they receive it by email.

**Acceptance Criteria:**

```gherkin
Feature: Send post to subscribers

  Scenario: Successful send with subscribers
    Given post "post-456" has status "draft"
    And publication "pub-123" has 2500 active subscribers
    When I POST /api/posts/post-456/send (authenticated as owner)
    Then the response status is 200
    And 2500 EmailSend records are created with status "queued"
    And 3 BullMQ jobs are enqueued on queue "email:send-batch" (batches of 1000)
    And post.status becomes "sent"
    And post.sent_at is set to now
    And post.published_at is set to now (if previously null)

  Scenario: Send with zero active subscribers
    Given post "post-456" has status "draft"
    And publication "pub-123" has 0 active subscribers
    When I POST /api/posts/post-456/send
    Then the response status is 200
    And no BullMQ jobs are enqueued
    And post.status becomes "sent"
    And the response message is "Post sent (0 active subscribers)"

  Scenario: Cannot re-send an already sent post
    Given post "post-456" has status "sent"
    When I POST /api/posts/post-456/send
    Then the response status is 409
    And the error code is "POST_ALREADY_SENT"

  Scenario: Worker processes batch and handles hard bounce
    Given a BullMQ job with postId "post-456" and 2 recipients
    And Postmark returns ErrorCode 422 (hard bounce) for recipient-2
    When the worker processes the job
    Then EmailSend for recipient-2 has status "failed"
    And subscriber "recipient-2" has status "bounced"
```

---

### US-04: Schedule Post for Future Sending

**As an** author,
**I want to** set a future date and time for my post to be sent,
**So that** I can prepare content in advance.

**Acceptance Criteria:**

```gherkin
Feature: Schedule a post

  Scenario: Author schedules a post via API
    Given post "post-456" has status "draft"
    When I PATCH /api/posts/post-456 with:
      | scheduled_at | "2026-06-01T09:00:00Z" |
    Then the response status is 200
    And post.status is "scheduled"
    And post.scheduled_at is "2026-06-01T09:00:00Z"

  Scenario: Editor UI shows datetime picker
    Given I am on the editor page for post "post-456"
    Then I see a datetime input labeled "Schedule for"
    When I pick a future date and time
    Then PATCH /api/posts/post-456 is called with the selected scheduled_at

  Scenario: Scheduled_at in the past is rejected
    When I PATCH /api/posts/post-456 with:
      | scheduled_at | "2020-01-01T00:00:00Z" |
    Then the response status is 400
    And the error indicates scheduled_at must be in the future
```

---

### US-05: View Published Post Publicly (SEO Page)

**As a** reader,
**I want to** visit a post's public URL and read it,
**So that** I can consume the content and share it.

**Acceptance Criteria:**

```gherkin
Feature: Public post reading experience

  Scenario: Free post fully accessible to anonymous reader
    Given post "post-456" is published with access "free"
    When an anonymous reader GETs /api/publications/pub-123/posts/hello-world
    Then the response status is 200
    And content_html is the full content
    And truncated is absent from the response

  Scenario: Paid post truncated at 20% for anonymous reader
    Given post "post-456" is published with access "paid"
    And the content_html is 10000 characters long
    When an anonymous reader requests the post
    Then the response includes content_html of length 2000 (20% of 10000)
    And truncated is true
    And upgrade_url is present

  Scenario: Paid post fully accessible to active paid subscriber
    Given the reader is authenticated and is an active paid subscriber of "pub-123"
    When they request the post
    Then content_html is the full content

  Scenario: Public page includes SEO metadata
    Given post "hello-world" has title "My Newsletter" and meta_description "A great read"
    When the Next.js page renders generateMetadata()
    Then the page title is at most 60 characters
    And the meta description is "A great read"
    And og:type is "article"
    And article:published_time reflects published_at
```

---

### US-06: Delete Draft Post

**As an** author,
**I want to** delete a draft post,
**So that** I can remove posts I no longer intend to publish.

**Acceptance Criteria:**

```gherkin
Feature: Delete a draft post

  Scenario: Author successfully deletes a draft
    Given post "post-456" has status "draft"
    When I DELETE /api/posts/post-456 (authenticated as owner)
    Then the response status is 200
    And the post no longer exists in the database

  Scenario: Cannot delete a sent post
    Given post "post-456" has status "sent"
    When I DELETE /api/posts/post-456
    Then the response status is 409
    And the error code is "POST_ALREADY_SENT"

  Scenario: Cannot delete another author's post
    Given I am authenticated as "other-author"
    When I DELETE /api/posts/post-456
    Then the response status is 403

  Scenario: Delete button visible in editor for drafts
    Given I am on the editor page for a draft post
    Then I see a "Delete" button
    When I click "Delete" and confirm
    Then DELETE /api/posts/post-456 is called
    And I am redirected to /dashboard/posts
```

---

## 2. API Endpoints — Complete Contract

### Existing (unchanged)
- `GET /api/publications/:pubId/posts` — paginated list, auth required
- `POST /api/publications/:pubId/posts` — create draft, auth required
- `GET /api/posts/:id` — get by UUID, optional auth, paywall enforced
- `PATCH /api/posts/:id` — update fields, auth required
- `POST /api/posts/:id/send` — send to subscribers, auth required
- `GET /api/posts/:id/analytics` — analytics, auth required

### New
- `GET /api/publications/:pubId/posts/:postSlug` — get by slug, no auth required, paywall enforced
- `DELETE /api/posts/:id` — delete draft, auth required

---

## 3. Non-Functional Requirements

| NFR | Requirement |
|-----|-------------|
| Autosave | Fires 30 seconds after the last content change in the editor |
| Paywall truncation | Character-based, server-side, 20% of `content_html` length |
| Batch size | 1000 EmailSend records per BullMQ job (see Research_Findings.md for Postmark limit caveat) |
| HTML sanitization | DOMPurify applied on every write of `content_html` (create and update) |
| Slug max length | 100 characters; derived from title, lowercased, alphanumeric + hyphens only |
| meta_description max | 160 characters; validated by Zod at API boundary |
| scheduled_at validation | Must be a future datetime (Zod `refine`) |
| Queue | BullMQ Queue instance is a Fastify plugin-level singleton — never created per request |
| Delete guard | `DELETE /api/posts/:id` only allowed when `post.status === 'draft'` |

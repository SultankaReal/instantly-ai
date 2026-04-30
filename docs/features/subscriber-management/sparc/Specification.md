# Specification: Subscriber Management
**Feature:** F2 | **Date:** 2026-05-01

---

## User Stories

### US-04a: Reader subscribes to newsletter

```
As a reader,
I want to enter my email on a publication page and subscribe,
So that I receive a confirmation email and, after confirming, future newsletters.

Acceptance Criteria:

Given I visit /p/{slug}
When I enter a valid email and click "Subscribe"
Then I receive HTTP 202 from POST /api/publications/:id/subscribers
And a confirmation email is sent to my inbox within 2 minutes
And I see a "Check your inbox" success message

Given I enter an email that is already pending_confirmation
When I click Subscribe
Then a fresh token is generated and a new confirmation email sent
And no duplicate subscriber row is created

Given I enter an already-active email
When I click Subscribe
Then I receive "Check your inbox" (re-sends confirmation) — no error exposed to reader
And the subscriber row is NOT changed to pending_confirmation
```

### US-04b: Reader confirms subscription

```
As a reader who received a confirmation email,
I want to click the confirmation link,
So that my subscription is activated.

Acceptance Criteria:

Given I click a valid, non-expired confirmation link (/confirm?token=xxx)
When the page loads
Then GET /api/subscribers/confirm?token=xxx returns 200
And subscriber.status changes to 'active', confirmed_at is set
And confirmation_token is cleared (single-use)
And I see a "Subscription confirmed" success page

Given the token is expired (> 48 hours)
When I click the link
Then I see "This link has expired — please subscribe again" message
And subscriber remains in pending_confirmation status

Given an invalid/unknown token
When I visit /confirm?token=invalid
Then I see an error page with a link back to the publication
```

### US-04c: Reader unsubscribes

```
As a subscriber,
I want to click Unsubscribe in any email footer,
So that I stop receiving emails immediately.

Acceptance Criteria:

Given I click an unsubscribe link in any email footer (/unsubscribe?token=xxx)
When the page loads
Then GET /api/subscribers/unsubscribe?token=xxx returns 200
And subscriber.status changes to 'unsubscribed', unsubscribed_at is set
And I see "You've been unsubscribed" confirmation page
And future sends skip this subscriber

Given I am already unsubscribed
When I click the link again
Then I see "You're already unsubscribed" — idempotent, no error

Given an invalid token
When I visit /unsubscribe?token=bad
Then I see an error page
```

### US-04d: Author views subscriber list

```
As an author,
I want to see my subscriber list with status and tier,
So that I can understand my audience.

Acceptance Criteria:

Given I am authenticated and have a publication
When I visit /dashboard/subscribers
Then I see a paginated table of subscribers with email, name, status, tier, subscribed_at
And total count is shown
And I can navigate pages (20/page default)

Given I have no subscribers
When I visit /dashboard/subscribers
Then I see an empty state with a link to share my publication
```

---

## API Endpoints

### POST /api/publications/:pubId/subscribers
- **Auth:** Public
- **Body:** `{ email: string, name?: string }`
- **Response 202:** `{ success: true, data: { message: string } }`
- **Response 404:** publication not found
- **Response 422:** invalid email format

### GET /api/subscribers/confirm
- **Auth:** Public
- **Query:** `token: string`
- **Response 200:** `{ success: true, data: { message: string } }`
- **Response 400:** invalid or expired token

### GET /api/subscribers/unsubscribe
- **Auth:** Public
- **Query:** `token: string` (HMAC-signed, encodes subscriber email)
- **Response 200:** `{ success: true, data: { message: string } }`
- **Response 400:** invalid token

### GET /api/publications/:pubId/subscribers
- **Auth:** Bearer JWT (author only)
- **Query:** `page?: number, limit?: number (max 100)`
- **Response 200:** `{ success: true, data: { subscribers: SubscriberResponse[], total, page, limit } }`

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | Confirmation email delivered < 2 minutes (p99) |
| Security | HMAC-signed unsubscribe tokens (constant-time comparison) |
| Security | Confirmation token is single-use — cleared on activation |
| Security | Confirmation token TTL: 48 hours |
| Security | No subscriber email exposed in URL params (HMAC token) |
| Reliability | BullMQ retry: 5 attempts with exponential backoff (1s base) |
| GDPR | Unsubscribe effective < 60 seconds, no re-add without explicit opt-in |
| Idempotency | Re-subscribe: upsert with fresh token, no duplicate row |
| Rate limiting | Subscribe endpoint: 10/hr per IP (spam protection) |

---

## Data Model (existing — no migrations needed)

`Subscriber` table already fully defined in Prisma schema:
- `publication_id`, `email` (unique composite)
- `status`: `pending_confirmation | active | unsubscribed | bounced | spam`
- `tier`: `free | paid | trial | past_due`
- `confirmation_token`, `confirmation_token_expires_at`
- `confirmed_at`, `unsubscribed_at`

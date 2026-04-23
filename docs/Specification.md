# Specification: Inkflow
**Версия:** 1.0 | **Дата:** 2026-04-23

---

## 1. User Stories & Acceptance Criteria

### Epic 1: Publishing

---

**US-01: Создание и отправка поста**

```
As a newsletter author,
I want to write and send an email newsletter post,
So that my subscribers receive it in their inbox within 5 minutes.

Acceptance Criteria:
Given I am logged in as an author with at least 1 subscriber
When I create a new post, write content, and click "Send Now"
Then all active subscribers receive the email within 5 minutes
And the email passes DMARC/DKIM/SPF checks
And open/click tracking pixels are injected

Given I click "Send Now" with 0 subscribers
When the confirmation dialog appears
Then I see "You have no subscribers yet — publish as web post?" prompt

Given I schedule a post for a future time
When the scheduled time arrives
Then the email is sent automatically without manual action
```

---

**US-02: SEO-native web publication**

```
As a newsletter author,
I want my posts to be automatically available as web pages with proper SEO,
So that readers can find my content through Google search.

Acceptance Criteria:
Given I publish a post (email + web)
When Google crawls my publication URL
Then the page has <title>, <meta description>, Open Graph tags, Twitter Card
And structured data (Article schema) is present
And page LCP < 1.5s on mobile (Lighthouse)
And sitemap.xml is updated within 5 minutes

Given I have a custom domain configured
When my post is published
Then it is accessible at both [slug].inkflow.io/posts/[id] and [custom-domain]/posts/[id]
And canonical URL points to the custom domain version
```

---

**US-03: Черновики и автосохранение**

```
As an author writing a long post,
I want my draft to be automatically saved every 30 seconds,
So that I never lose work due to browser crash or accidental close.

Acceptance Criteria:
Given I am editing a post
When 30 seconds pass without a save action
Then the draft is silently saved to the database
And "Saved X seconds ago" indicator updates in the toolbar

Given my browser crashes while editing
When I reopen the editor for the same post
Then I see the auto-saved version with a "Restore draft" prompt
```

---

### Epic 2: Subscriber Management

---

**US-04: Подписка читателя**

```
As a reader,
I want to subscribe to a newsletter with my email,
So that I receive new posts automatically.

Acceptance Criteria:
Given I visit an author's publication page
When I enter my email and click Subscribe
Then I receive a confirmation email within 2 minutes
And after clicking the confirmation link, I am added as a free subscriber
And the author's subscriber count increments by 1

Given the email is already subscribed
When I attempt to subscribe again
Then I see "You're already subscribed!" — no duplicate created

Given I click Unsubscribe in any email footer
When I confirm the unsubscribe
Then I am immediately removed from all future sends (< 60 seconds)
And I receive a confirmation of unsubscription
```

---

**US-05: Импорт подписчиков с Substack**

```
As an author migrating from Substack,
I want to import my subscriber list from a Substack export ZIP,
So that I can start sending immediately without manually re-collecting emails.

Acceptance Criteria:
Given I upload a valid Substack export ZIP
When the import completes
Then all valid email addresses are imported as subscribers
And free/paid subscriber status is preserved based on Substack metadata
And I see a summary: "Imported X free + Y paid subscribers"
And duplicate emails are deduplicated automatically

Given the ZIP contains invalid rows (malformed emails)
When import completes
Then valid rows are imported and invalid rows are reported in a downloadable error log
And the import does not fail entirely due to partial bad data

Given I import subscribers
When the process is complete
Then no welcome email is sent automatically (opt-in checkbox shown before import)
```

---

### Epic 3: Paid Subscriptions

---

**US-06: Настройка платных подписок**

```
As an author,
I want to enable paid subscriptions with my own price,
So that my readers can support me financially and I receive 100% of revenue minus payment processing fees.

Acceptance Criteria:
Given I connect my Stripe account and set a price (e.g. $8/month)
When a reader subscribes to paid tier
Then Stripe processes the payment
And the author receives the full amount minus Stripe fees (2.9% + $0.30)
And Inkflow takes 0% platform commission
And the author's Stripe dashboard shows the payout immediately

Given a reader's payment fails on renewal
When Stripe webhook fires payment_failed
Then the subscriber is moved to "past due" status
And an automated dunning email is sent to the subscriber
And the author is notified of the failed payment
```

---

**US-07: Paywall для контента**

```
As an author,
I want to mark specific posts as paid-only,
So that only paying subscribers can read the full content.

Acceptance Criteria:
Given I set a post as "Paid only"
When a free subscriber opens the web version
Then they see the first 20% of the content
And a subscription prompt replaces the rest ("Subscribe to read the full post")

Given a paid subscriber opens the same post
When they are authenticated
Then they see the full content with no paywall

Given I set a post as "Free" (default)
When any visitor opens the web version
Then the full content is visible without login
```

---

### Epic 4: Analytics

---

**US-08: Email performance analytics**

```
As an author,
I want to see open rates and click rates for each email I send,
So that I can understand which content resonates with my audience.

Acceptance Criteria:
Given I sent an email 24 hours ago
When I open the post analytics page
Then I see: opens count, unique opens %, clicks count, click rate %
And I see a time-series chart of opens over 24h
And the data updates in near-real-time (< 5 minute delay)

Given a subscriber opens the same email 3 times
When opens are counted
Then unique open count = 1, total open count = 3
And the distinction is visible in analytics
```

---

### Epic 5: AI Writing Assistant (v1.0)

---

**US-09: AI-генерация черновика**

```
As an author with writer's block,
I want to generate a draft post from a topic or title,
So that I have a starting point to edit rather than a blank page.

Acceptance Criteria:
Given I click "Generate draft" and enter "5 lessons from 2 years of paid newsletters"
When the AI generates content (< 30 seconds)
Then I see a 500–800 word draft in the editor
And the draft is editable immediately
And a disclaimer "AI-generated draft — edit before sending" is shown

Given the Claude API is unavailable
When I click "Generate draft"
Then I see "AI assistant is temporarily unavailable" — no silent failure
And I can still write manually
```

---

## 2. Feature Matrix

| Feature | MVP | v1.0 | v2.0 |
|---------|:---:|:----:|:----:|
| Rich text editor | ✅ | ✅ | ✅ |
| Email delivery | ✅ | ✅ | ✅ |
| Subscriber management | ✅ | ✅ | ✅ |
| Paid subscriptions (Stripe) | ✅ | ✅ | ✅ |
| Paid subscriptions (CloudPayments) | ✅ | ✅ | ✅ |
| SEO-native public posts | ✅ | ✅ | ✅ |
| Substack import | ✅ | ✅ | ✅ |
| Basic analytics | ✅ | ✅ | ✅ |
| Custom domain | ✅ | ✅ | ✅ |
| AI writing assistant | — | ✅ | ✅ |
| Cross-publication recommendations | — | ✅ | ✅ |
| Ad placements | — | ✅ | ✅ |
| Digital products | — | — | ✅ |
| Podcast/Video hosting | — | — | ✅ |
| Mobile apps (iOS/Android) | — | — | ✅ |
| Team collaboration | — | ✅ | ✅ |
| Public API | — | — | ✅ |

---

## 3. Non-Functional Requirements

### Performance NFRs

| NFR | Target | Measurement |
|-----|--------|-------------|
| API response time (p50) | < 50ms | Prometheus histogram |
| API response time (p99) | < 200ms | Prometheus histogram |
| Email delivery latency | < 5 min (95th pct) | Queue metrics |
| Web page LCP | < 1.5s | Lighthouse CI |
| Web page TTFB | < 300ms | Nginx access logs |
| Uptime | ≥ 99.5% | Uptime Robot |
| Email delivery rate | ≥ 98% | Postmark dashboard |

### Security NFRs

| NFR | Implementation |
|-----|---------------|
| HTTPS | Let's Encrypt + auto-renew via Certbot |
| Email authentication | DMARC (p=quarantine), DKIM (2048-bit), SPF |
| Password hashing | bcrypt, cost factor 12 |
| Session tokens | JWT (HS256), access=15min, refresh=7d (Redis blacklist) |
| Rate limiting | 100/min anonymous, 1000/min authenticated (Redis sliding window) |
| Content security | DOMPurify on all user-generated HTML |
| SQL injection | Parameterized queries only (no string concatenation) |
| API keys | Hashed with SHA-256, never stored plaintext |
| GDPR | Consent logs, deletion within 24h, export on request |

### Reliability NFRs

| NFR | Target |
|-----|--------|
| Email queue retry | 5 attempts with exponential backoff |
| Database backups | Daily automated + point-in-time recovery (7 days) |
| Graceful shutdown | SIGTERM → drain in-flight requests within 30s |
| Health check | GET /health returns 200 within 100ms |

---

## 4. Data Model (Key Entities)

```
User {
  id: UUID (PK)
  email: VARCHAR(255) UNIQUE NOT NULL
  password_hash: VARCHAR(255) NOT NULL
  role: ENUM('author', 'admin')
  created_at: TIMESTAMPTZ
}

Publication {
  id: UUID (PK)
  author_id: UUID FK → User
  slug: VARCHAR(100) UNIQUE NOT NULL
  name: VARCHAR(255) NOT NULL
  custom_domain: VARCHAR(255) UNIQUE
  stripe_account_id: VARCHAR(255)
  pricing_monthly: INTEGER (cents)
  pricing_annual: INTEGER (cents)
  created_at: TIMESTAMPTZ
}

Post {
  id: UUID (PK)
  publication_id: UUID FK → Publication
  title: VARCHAR(500) NOT NULL
  content_html: TEXT
  excerpt: TEXT
  slug: VARCHAR(255) NOT NULL
  status: ENUM('draft', 'scheduled', 'sent', 'published')
  access: ENUM('free', 'paid')
  scheduled_at: TIMESTAMPTZ
  sent_at: TIMESTAMPTZ
  created_at: TIMESTAMPTZ
  UNIQUE(publication_id, slug)
}

Subscriber {
  id: UUID (PK)
  publication_id: UUID FK → Publication
  email: VARCHAR(255) NOT NULL
  status: ENUM('pending_confirmation', 'active', 'unsubscribed', 'bounced', 'spam')
  tier: ENUM('free', 'paid', 'trial', 'past_due')
  stripe_subscription_id: VARCHAR(255)
  subscribed_at: TIMESTAMPTZ
  UNIQUE(publication_id, email)
}

EmailSend {
  id: UUID (PK)
  post_id: UUID FK → Post
  subscriber_id: UUID FK → Subscriber
  status: ENUM('queued', 'sent', 'delivered', 'bounced', 'failed')
  sent_at: TIMESTAMPTZ
  message_id: VARCHAR(255)  -- Postmark ID
}

EmailEvent {
  id: UUID (PK)
  email_send_id: UUID FK → EmailSend
  event_type: ENUM('open', 'click', 'bounce', 'spam_complaint')
  occurred_at: TIMESTAMPTZ
  metadata: JSONB  -- click URL, user agent, etc.
}
```

---

## 5. API Endpoints (Key)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| POST | /api/auth/register | None | Create account |
| POST | /api/auth/login | None | Login → JWT pair |
| POST | /api/auth/refresh | Refresh token | Rotate tokens |
| GET | /api/publications/:slug | None | Public publication info |
| POST | /api/publications | Author | Create publication |
| GET | /api/publications/:id/posts | Author | List posts |
| POST | /api/publications/:id/posts | Author | Create post |
| PUT | /api/posts/:id | Author | Update post |
| POST | /api/posts/:id/send | Author | Trigger email send |
| GET | /api/posts/:id/analytics | Author | Post analytics |
| POST | /api/publications/:id/subscribers | None | Subscribe (email) |
| DELETE | /api/subscribers/:token | None | Unsubscribe (tokenized) |
| POST | /api/publications/:id/import | Author | Substack CSV import |
| POST | /api/publications/:id/checkout | Reader | Initiate Stripe Checkout session |
| POST | /api/stripe/webhook | Stripe sig | Payment events |
| POST | /api/webhooks/postmark | Postmark sig | Email open/click/bounce events |
| POST | /api/ai/generate-draft | Author | AI draft generation (v1.0) |
| GET | /api/health | None | Health check |

---

## 6. Success Metrics

| Metric | Formula | Target M6 |
|--------|---------|:----------:|
| Activation Rate | Users who send first email / Signups | ≥ 60% |
| Free→Paid Conversion | Paying users / Total users | ≥ 5% |
| D7 Retention (paying) | Paying users active D7 / Paying users D0 | ≥ 75% |
| D30 Retention (paying) | — | ≥ 70% |
| Email Delivery Rate | Delivered / Attempted | ≥ 98% |
| NPS | Detractor/Passive/Promoter formula | ≥ 50 |
| Sean Ellis PMF | "Very disappointed" if gone / Total surveyed | ≥ 40% |

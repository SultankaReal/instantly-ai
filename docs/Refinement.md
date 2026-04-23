# Refinement: Inkflow
**Дата:** 2026-04-23 | **Scope:** Edge Cases, Testing Strategy, Performance Optimizations, Security Hardening

---

## 1. Edge Cases Matrix

### Email Send Pipeline

| Edge Case | Trigger | Expected Behavior | Test Coverage |
|-----------|---------|------------------|---------------|
| Send with 0 active subscribers | Author sends post | Return ValidationError "No subscribers"; prompt for web-only publish | Unit + Integration |
| Partial batch failure | Postmark returns mix of success/error | Successful sends marked 'sent'; failed marked 'failed'; job does NOT fail | Integration |
| Duplicate send attempt | POST /send on already-'sent' post | Return 409 ConflictError "Post already sent" | Unit |
| Subscriber unsubscribed mid-send | Unsubscribe between batch enqueue and worker execute | Worker skips subscriber if status = 'unsubscribed' at execution time | Integration |
| Email bounce on send | Postmark returns ErrorCode 406 | Mark EmailSend as 'bounced'; update Subscriber.status → 'bounced' | Integration |
| Worker crash mid-batch | Node process dies | BullMQ moves job to failed queue; retry on restart; idempotency via EmailSend.status check | Integration |
| Postmark rate limit (429) | > 300 req/min to Postmark | BullMQ retries with backoff; alert if > 3 retries on same job | E2E |
| HTML too large (> 10MB) | Extremely long post | Validate content size at POST /posts; reject with 413 | Unit |
| Unsubscribe token replay | Same token used twice | First use succeeds; second returns 200 (idempotent, no error) | Unit |
| Custom domain not verified | Send before DNS propagates | Email uses `[slug].inkflow.io` as fallback; log warning | Integration |

### Subscriber Management

| Edge Case | Trigger | Expected Behavior | Test Coverage |
|-----------|---------|------------------|---------------|
| Double subscribe | Same email, same publication | Return 200 "Already subscribed"; no duplicate created | Unit |
| Confirmation token expired | Click link after 48h | Return 410 Gone "Link expired"; offer to resend | Unit |
| Import with 100% invalid emails | All rows malformed in CSV | Return 200 with imported=0, failed=N; show error log | Integration |
| Import > 100K rows | Very large Substack export | Stream CSV; process in chunks of 5000; progress indicator | E2E |
| Subscriber resubscribes after unsubscribe | Click subscribe after unsubscribe | Update status to 'pending_confirmation'; send new confirmation | Integration |
| Bounced subscriber attempts subscribe | Hard bounce then re-subscribe | Allow after 30 days; block within 30 days with explanation | Unit |

### Payments (Stripe)

| Edge Case | Trigger | Expected Behavior | Test Coverage |
|-----------|---------|------------------|---------------|
| Webhook duplicate delivery | Stripe sends same event twice | Idempotent: check if event already processed (store event_id in DB) | Integration |
| Checkout abandoned | Reader opens Stripe UI, closes tab | No subscriber tier change; session expires in 24h (Stripe default) | — (Stripe handles) |
| Subscription cancels same day | Cancels within trial period | Downgrade to free immediately; send confirmation email | Integration |
| Payment succeeds, webhook delayed (> 5min) | Stripe network issue | Subscriber temporarily shows 'pending'; webhook eventual consistency | E2E |
| Author disconnects Stripe | Removes Stripe account | Existing paid subscribers notified; new paid signups blocked | Integration |
| Refund after access | Reader requests refund | Manual admin action; subscriber downgraded to free | Manual |

### SEO / Web

| Edge Case | Trigger | Expected Behavior | Test Coverage |
|-----------|---------|------------------|---------------|
| Post title exceeds 60 chars | Long title input | SEO title truncated to 57 + '...' in meta; full title shown on page | Unit |
| No cover image set | Post without cover | Use publication avatar → DEFAULT_OG_IMAGE fallback | Unit |
| Custom domain + CNAME not set | Author enables custom domain, DNS not configured | Show DNS instructions; continue serving from [slug].inkflow.io | Integration |
| Slug collision | Two posts with same title → same slug | Auto-append `-2`, `-3`, etc. | Unit |
| Post deleted after indexing | Google has cached URL | Return 410 Gone (not 404) with canonical meta tag | Integration |

### AI Writing Assistant

| Edge Case | Trigger | Expected Behavior | Test Coverage |
|-----------|---------|------------------|---------------|
| Topic too vague ("write about tech") | Very short/generic topic | Accept; Claude generates generic draft; no block | — |
| Claude API timeout (> 30s) | Slow API response | Return 503 ServiceUnavailable; clear error message; no silent fail | Integration |
| Rate limit hit (10/hour) | Author exceeds AI limit | Return 429 with retryAfter = seconds until window resets | Unit |
| Claude returns empty response | Edge case in API | Retry once; if still empty, return 503 | Integration |
| Concurrent requests (same author) | Author spams "Generate" button | Frontend debounce (1s); backend: only 1 in-flight per author (Redis lock) | Unit |

---

## 2. Testing Strategy

### 2.1 Test Pyramid

```
         /\
        /E2E\
       / (5%) \
      /─────────\
     /Integration\
    /   (25%)     \
   /───────────────\
  /    Unit Tests   \
 /     (70%)         \
/─────────────────────\
```

**Target coverage: ≥ 80% overall, 100% on critical paths (auth, payments, email send)**

### 2.2 Unit Tests (Vitest)

**Scope:** Pure functions, individual module methods, validation logic

```typescript
// Example: Email Send Pipeline unit tests
describe('sendPost()', () => {
  it('throws AuthError when post not found', async () => {
    mockDB.findPost.mockResolvedValue(null)
    await expect(sendPost('id', 'authorId')).rejects.toThrow(AuthError)
  })

  it('throws ConflictError when post already sent', async () => {
    mockDB.findPost.mockResolvedValue({ status: 'sent' })
    await expect(sendPost('id', 'authorId')).rejects.toThrow(ConflictError)
  })

  it('chunks subscribers into batches of 1000', async () => {
    mockDB.findActiveSubscribers.mockResolvedValue(Array(2500).fill(mockSub))
    await sendPost('id', 'authorId')
    expect(EmailQueue.add).toHaveBeenCalledTimes(3) // 1000 + 1000 + 500
  })
})

// Example: SEO Metadata unit tests
describe('generateSEOMetadata()', () => {
  it('truncates title to 60 chars with ellipsis', () => {
    const post = { title: 'A'.repeat(70) }
    const meta = generateSEOMetadata(post, mockPublication)
    expect(meta.title.length).toBeLessThanOrEqual(60)
    expect(meta.title).toEndWith('...')
  })

  it('uses custom domain for canonical URL', () => {
    const pub = { custom_domain: 'mysite.com', slug: 'author' }
    const meta = generateSEOMetadata(mockPost, pub)
    expect(meta.canonical).toContain('https://mysite.com')
  })
})
```

**Key unit test targets:**
- `sendPost()` — all validation branches
- `handleStripeWebhook()` — each event type + unknown event
- `generateSEOMetadata()` — truncation, fallbacks, custom domain
- `parseSubstackExport()` — valid/invalid rows, empty CSV
- `generateDraft()` — rate limit, validation
- Auth middleware — valid/invalid/expired tokens
- Rate limiter — counter increment, window expiry

### 2.3 Integration Tests (Vitest + testcontainers)

**Setup:** Real PostgreSQL + Redis via Docker testcontainers. No mocks on DB/queue.

```typescript
describe('Email send integration', () => {
  beforeAll(async () => {
    db = await startPostgresContainer()
    redis = await startRedisContainer()
    await runMigrations(db)
  })

  it('creates EmailSend records and enqueues jobs', async () => {
    const { publication, post, subscribers } = await createTestFixtures(db, 2500)

    const result = await sendPost(post.id, publication.author_id)

    const sends = await db.emailSend.findMany({ where: { post_id: post.id } })
    expect(sends).toHaveLength(2500)
    expect(sends.every(s => s.status === 'queued')).toBe(true)

    const jobs = await redis.lrange('bull:email:wait', 0, -1)
    expect(jobs).toHaveLength(3) // 3 batches
  })
})
```

**Key integration test targets:**
- Full email send flow (sendPost → BullMQ enqueue → worker picks up)
- Stripe webhook handler with DB state transitions
- Substack import with duplicate handling
- Authentication flow (register → login → refresh → logout)
- Subscriber confirmation flow (subscribe → confirm → active)
- Custom domain resolution in Next.js route

### 2.4 E2E Tests (Playwright)

**Scope:** Critical user journeys in a real browser against the full stack

```typescript
// Golden path: author sends first email
test('Author sends first email to subscribers', async ({ page }) => {
  await page.goto('/dashboard')
  await page.fill('[data-testid="email"]', 'author@test.com')
  await page.fill('[data-testid="password"]', 'Password123!')
  await page.click('[data-testid="login-btn"]')

  await page.click('[data-testid="new-post"]')
  await page.fill('[data-testid="post-title"]', 'Test Newsletter')
  await page.fill('[data-testid="post-content"]', 'Hello subscribers!')
  await page.click('[data-testid="send-now"]')

  await expect(page.getByText('Sending to 5 subscribers')).toBeVisible()
  await expect(page.getByText('Sent successfully')).toBeVisible({ timeout: 10000 })
})

// Paywall: free subscriber cannot access paid post
test('Free subscriber sees paywall on paid post', async ({ page }) => {
  await page.goto('/test-pub/posts/paid-post-slug')
  await expect(page.getByTestId('post-content')).toBeVisible()
  await expect(page.getByTestId('paywall-overlay')).toBeVisible()
  await expect(page.getByText('Subscribe to read the full post')).toBeVisible()
})
```

**E2E test suites:**
1. Auth: register → verify → login → refresh → logout
2. Publishing: create draft → autosave → preview → send now
3. Subscription: subscribe → confirm email → unsubscribe
4. Payments: paid subscribe → Stripe checkout → tier upgrade
5. Import: upload Substack ZIP → review → confirm import
6. SEO: publish post → verify meta tags → verify sitemap
7. AI: generate draft → edit → send

### 2.5 Performance Tests (k6)

```javascript
// Load test: 100 concurrent post sends
import http from 'k6/http'
import { check } from 'k6'

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(99)<200'], // p99 < 200ms
    http_req_failed: ['rate<0.01'],   // < 1% errors
  },
}

export default function () {
  const res = http.get(`${__ENV.API_URL}/api/publications/test-pub`)
  check(res, { 'status is 200': (r) => r.status === 200 })
}
```

**Performance test scenarios:**
- API p99 < 200ms at 100 concurrent users
- Email queue throughput: 10K emails in < 2 minutes
- Next.js SSR: LCP < 1.5s on 4G throttled (Lighthouse CI)
- Database: query time < 50ms for subscriber list (10K rows)
- Import: 50K subscriber CSV processed < 30 seconds

---

## 3. Performance Optimizations

### 3.1 Database

| Optimization | Implementation | Impact |
|-------------|---------------|--------|
| Composite indexes on hot queries | `(publication_id, status)` on subscribers | Query: O(log n) vs O(n) |
| Partial index for scheduled posts | `WHERE status = 'scheduled'` | Scheduler query: tiny index |
| JSONB `metadata` column for events | No schema change for new event types | Flexible without migration |
| Connection pooling | PgBouncer (transaction mode) | Supports 10× more concurrent requests |
| Analytics queries | Materialized views for open/click rates | Refresh every 5 minutes vs real-time scan |
| Large result pagination | Cursor-based pagination on subscriber list | Consistent < 50ms regardless of offset |

### 3.2 API

| Optimization | Implementation | Impact |
|-------------|---------------|--------|
| Response compression | `@fastify/compress` (gzip/brotli) | 60–80% payload reduction |
| Field selection | GraphQL-style `?fields=id,email,status` | Reduce bandwidth for list views |
| Redis caching | Cache publication metadata (5min TTL) | Eliminate repeat DB reads on every request |
| N+1 prevention | Prisma `include` for relational queries | 1 query vs N+1 |
| Schema validation | Zod at route entry, fail fast | Reject invalid requests before DB hit |

### 3.3 Frontend (Next.js)

| Optimization | Implementation | Impact |
|-------------|---------------|--------|
| ISR for publication pages | `revalidate: 300` (5min) | Serve from CDN; rebuild only on publish |
| Image optimization | Next.js `<Image>` with WebP + srcset | 50–70% image size reduction |
| Code splitting | App Router automatic per-route chunks | Smaller initial bundle |
| Critical CSS | Tailwind PurgeCSS | Eliminates unused styles |
| Prefetching | `<Link prefetch>` for dashboard nav | Instant navigation feel |
| Web Vitals monitoring | `reportWebVitals()` → Prometheus | Continuous LCP/FID/CLS tracking |

### 3.4 Email Delivery

| Optimization | Implementation | Impact |
|-------------|---------------|--------|
| Batch size tuning | 1000/batch (Postmark max) vs smaller | Minimum API round-trips |
| Worker concurrency | 10 parallel Postmark requests per worker | 10× throughput vs sequential |
| HTML pre-compilation | Render once, substitute tokens per recipient | O(1) render vs O(n) |
| Unsubscribe token caching | Redis cache for token lookup (1h TTL) | Avoid DB hit on every email open |

---

## 4. Security Hardening

### 4.1 API Security Checklist

- [ ] All endpoints require auth except: `/api/auth/*`, `/api/publications/:slug` (GET), `/api/webhooks/*`, `/api/health`
- [ ] Stripe webhook validated with `Stripe.constructEvent()` — reject 400 if signature invalid
- [ ] Postmark webhook validated with shared secret header comparison
- [ ] File upload: validate MIME type server-side (not just extension); limit to 10MB
- [ ] All subscriber operations verify `publication.author_id === request.user.id`
- [ ] Unsubscribe uses opaque random token (not subscriber.id) in email links
- [ ] AI endpoint: per-author Redis rate limit prevents abuse
- [ ] CORS: explicit allowlist (`inkflow.io`, `*.inkflow.io`, author custom domains)
- [ ] Security headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`

### 4.2 Content Security

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-{random}';
  style-src 'self' 'unsafe-inline';    # Required for Tailwind inline
  img-src 'self' https: data:;
  font-src 'self';
  connect-src 'self' https://api.inkflow.io;
  frame-src 'none';
  object-src 'none';
```

### 4.3 GDPR Compliance

| Requirement | Implementation | Timeline |
|-------------|---------------|---------|
| Consent at subscribe | Double opt-in via email confirmation | MVP |
| Consent logs | `subscribers.subscribed_at` + IP (hashed) | MVP |
| Data deletion | `DELETE /api/subscribers/:id` removes all PII within 24h | MVP |
| Data export | `GET /api/publications/:id/subscribers.csv` | MVP |
| Unsubscribe | One-click, no login, < 60 second effect | MVP |
| Retention policy | Inactive subscribers purged after 3 years (configurable) | v1.0 |
| DPA (Data Processing Agreement) | Author accepts on signup | MVP |

---

## 5. Technical Debt Register

| Item | Priority | Effort | Rationale for Deferral |
|------|---------|--------|----------------------|
| Meilisearch for full-text search | Medium | 3d | PostgreSQL FTS sufficient for MVP scale |
| CloudPayments integration | High | 5d | RU market; implement in parallel with Stripe |
| Webhook event deduplication table | High | 1d | Required before production; add in Week 4 |
| Admin dashboard | Low | 5d | Internal tooling; not customer-facing at launch |
| Email template A/B testing | Low | 3d | Post-PMF feature |
| Subscriber segment automation | Medium | 5d | Manual segments sufficient for MVP |
| PgBouncer connection pooler | Medium | 1d | Add when > 3 API replicas needed |
| Materialized views for analytics | Medium | 2d | Sufficient with indexes at < 10K sends/post |
| Multi-language support | Low | 10d | English + Russian UI; i18n later |
| Read replicas for PostgreSQL | Low | 2d | Single primary sufficient until 1K+ active authors |

---

## 6. Refinement Decisions (ADR Summary)

### ADR-001: Fastify over Express
**Decision:** Use Fastify  
**Reason:** 2× faster than Express; built-in schema validation reduces boilerplate; well-maintained  
**Rejected:** NestJS (too opinionated for speed of MVP), Hono (ecosystem immaturity)

### ADR-002: Prisma over Knex / raw SQL
**Decision:** Use Prisma ORM  
**Reason:** Type-safe queries prevent SQL injection by default; migrations are versioned; developer experience  
**Trade-off:** Slightly more verbose for complex queries; use `$queryRaw` for analytics

### ADR-003: BullMQ over Agenda / node-cron
**Decision:** Use BullMQ  
**Reason:** Redis-backed persistence survives restarts; built-in retry logic; Bull Board dashboard  
**Rejected:** Simple node-cron (no persistence, no retry), SQS (requires AWS)

### ADR-004: Postmark over SendGrid / Mailgun
**Decision:** Use Postmark as primary  
**Reason:** Highest transactional deliverability (99%+ delivery rate); dedicated IP pools; detailed webhooks  
**Fallback:** Resend (modern API, same webhook format, easy swap)

### ADR-005: MinIO over AWS S3
**Decision:** Use MinIO (self-hosted)  
**Reason:** VPS constraint; S3-compatible API means zero code change if migrating to S3 later  
**Upgrade path:** Change `MINIO_ENDPOINT` env var → S3 endpoint

### ADR-006: ISR over SSG for post pages
**Decision:** Use Next.js ISR with 5-minute revalidation  
**Reason:** Posts can be updated after publish (typo fixes); ISR serves from CDN with automatic refresh  
**Rejected:** Full SSG (stale content), pure SSR (no CDN caching = poor LCP)

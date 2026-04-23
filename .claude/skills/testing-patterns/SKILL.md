---
name: testing-patterns
description: >
  Testing patterns for Inkflow using Vitest, Testcontainers, and Playwright.
  Provides templates for unit tests, integration tests with real PostgreSQL/Redis,
  and E2E tests for critical user flows. Load when writing tests for any Inkflow feature.
version: "1.0"
maturity: production
---

# Testing Patterns — Inkflow

## Unit Test Pattern (Vitest)

```typescript
// apps/api/src/services/seo.service.test.ts
import { describe, it, expect } from 'vitest'
import { generateSEOMetadata } from './seo.service'

describe('generateSEOMetadata', () => {
  it('should truncate title to 60 chars', () => {
    const post = { title: 'A'.repeat(70), content_html: '<p>Content</p>', excerpt: null, slug: 'test' }
    const pub = { name: 'My Newsletter', slug: 'my-newsletter', custom_domain: null }
    
    const result = generateSEOMetadata(post, pub)
    
    expect(result.title.length).toBeLessThanOrEqual(60)
  })

  it('should use custom domain for canonical URL when configured', () => {
    const pub = { name: 'Newsletter', slug: 'nl', custom_domain: 'mynewsletter.com' }
    const result = generateSEOMetadata({ title: 'Test', excerpt: null, slug: 'post-1' }, pub)
    expect(result.canonicalUrl).toContain('mynewsletter.com')
  })

  it('should handle null content_html without throwing', () => {
    const post = { title: 'Test', content_html: null, excerpt: null, slug: 'test' }
    expect(() => generateSEOMetadata(post, { name: 'NL', slug: 'nl', custom_domain: null })).not.toThrow()
  })
})
```

## Integration Test Pattern (Testcontainers + Vitest)

```typescript
// tests/integration/subscribe.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PostgreSqlContainer, StartedPostgreSqlContainer } from 'testcontainers'
import { PrismaClient } from '@prisma/client'
import { subscribe, confirmSubscription } from '../../apps/api/src/services/subscriber.service'

let container: StartedPostgreSqlContainer
let prisma: PrismaClient

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start()
  prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } })
  await prisma.$executeRaw`-- run migrations here`
}, 60000)

afterAll(async () => {
  await prisma.$disconnect()
  await container.stop()
})

beforeEach(async () => {
  await prisma.emailSend.deleteMany()
  await prisma.subscriber.deleteMany()
  await prisma.publication.deleteMany()
  await prisma.user.deleteMany()
})

describe('subscribe()', () => {
  it('should create subscriber with pending_confirmation status', async () => {
    const pub = await prisma.publication.create({ data: { /* test data */ } })
    
    await subscribe(pub.id, 'test@example.com')
    
    const subscriber = await prisma.subscriber.findFirst({
      where: { publication_id: pub.id, email: 'test@example.com' }
    })
    expect(subscriber?.status).toBe('pending_confirmation')
  })

  it('should not create duplicate on second subscribe attempt', async () => {
    const pub = await prisma.publication.create({ data: { /* ... */ } })
    
    await subscribe(pub.id, 'test@example.com')
    await subscribe(pub.id, 'test@example.com')  // second attempt
    
    const count = await prisma.subscriber.count({ where: { publication_id: pub.id } })
    expect(count).toBe(1)  // no duplicate
  })
})
```

## API Integration Test Pattern (Supertest + Fastify)

```typescript
// tests/integration/api/posts.test.ts
import { buildApp } from '../../apps/api/src/app'
import { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp({ testing: true })
  await app.ready()
})

afterAll(async () => { await app.close() })

describe('POST /api/posts/:id/send', () => {
  it('should return 401 without auth token', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/posts/test-id/send',
    })
    expect(response.statusCode).toBe(401)
  })

  it('should return 403 when author does not own the post', async () => {
    const token = await getTestToken('other-author')
    const response = await app.inject({
      method: 'POST',
      url: `/api/posts/${testPost.id}/send`,
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(response.statusCode).toBe(403)
  })
})
```

## E2E Test Pattern (Playwright)

```typescript
// tests/e2e/subscribe.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Subscriber confirmation flow', () => {
  test('should subscribe and confirm via email link', async ({ page }) => {
    await page.goto('/test-publication')
    
    await page.fill('[data-testid="subscribe-email"]', 'e2e-test@example.com')
    await page.click('[data-testid="subscribe-button"]')
    
    await expect(page.locator('[data-testid="confirmation-sent"]')).toBeVisible()
    
    // Simulate confirmation link click (in real test, check test mailbox)
    const confirmUrl = await getConfirmationUrl('e2e-test@example.com')
    await page.goto(confirmUrl)
    
    await expect(page.locator('[data-testid="subscription-confirmed"]')).toBeVisible()
  })
})
```

## Security Test Pattern

```typescript
// tests/integration/security/paywall.test.ts
describe('Paywall enforcement', () => {
  it('should truncate content server-side for free subscribers', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/posts/${paidPost.id}`,
      headers: { Authorization: `Bearer ${freeSubscriberToken}` }
    })
    
    const body = JSON.parse(response.payload)
    // Content should be truncated, not full post
    expect(body.content_html.length).toBeLessThan(paidPost.content_html.length)
    expect(body.is_truncated).toBe(true)
  })

  it('should never return full content without server-side check (not just frontend)', async () => {
    // Bypass frontend by calling API directly
    const response = await app.inject({
      method: 'GET',
      url: `/api/posts/${paidPost.id}`,
      // No auth header at all
    })
    const body = JSON.parse(response.payload)
    expect(body.content_html.length).toBeLessThan(paidPost.content_html.length)
  })
})
```

## Test Data Factories

```typescript
// tests/factories/index.ts
export const createTestPublication = (overrides = {}) => ({
  name: 'Test Newsletter',
  slug: `test-newsletter-${Date.now()}`,
  custom_domain: null,
  ...overrides
})

export const createTestPost = (publicationId: string, overrides = {}) => ({
  publication_id: publicationId,
  title: 'Test Post',
  content_html: '<p>Test content</p>',
  slug: `test-post-${Date.now()}`,
  status: 'draft',
  access: 'free',
  ...overrides
})
```

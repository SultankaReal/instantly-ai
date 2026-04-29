---
name: testing-patterns
description: Vitest + Playwright + Testcontainers patterns for Поток. Covers unit test templates for warmup/campaign services, integration test setup with real PostgreSQL/Redis, and E2E golden paths.
version: "1.0"
maturity: production
---

# Testing Patterns — Поток

## Vitest Unit Test Template

```typescript
// apps/api/src/services/warmup.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDailyVolume, recalculateInboxScore } from './warmup.service'

describe('getDailyVolume', () => {
  it('should return 5-10 on day 3 (initial phase)', () => {
    const volume = getDailyVolume(3)
    expect(volume).toBeGreaterThanOrEqual(5)
    expect(volume).toBeLessThanOrEqual(10)
  })

  it('should return 20-40 on day 10 (moderate phase)', () => {
    const volume = getDailyVolume(10)
    expect(volume).toBeGreaterThanOrEqual(20)
    expect(volume).toBeLessThanOrEqual(40)
  })

  it('should return 100-200 on day 25 (maintenance phase)', () => {
    const volume = getDailyVolume(25)
    expect(volume).toBeGreaterThanOrEqual(100)
    expect(volume).toBeLessThanOrEqual(200)
  })
})
```

## Testcontainers Integration Test Setup

```typescript
// tests/integration/setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { RedisContainer } from '@testcontainers/redis'
import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

let postgresContainer: PostgreSqlContainer
let redisContainer: RedisContainer
export let prisma: PrismaClient

beforeAll(async () => {
  postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('potok_test')
    .start()

  redisContainer = await new RedisContainer('redis:7-alpine').start()

  const databaseUrl = postgresContainer.getConnectionUri()
  process.env.DATABASE_URL = databaseUrl

  // Run migrations
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: databaseUrl } })

  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
})

afterAll(async () => {
  await prisma.$disconnect()
  await postgresContainer.stop()
  await redisContainer.stop()
})

afterEach(async () => {
  // Clean tables after each test (order matters for FK)
  await prisma.$executeRaw`TRUNCATE unsubscribes, warmup_events, email_sends, contacts, campaigns, inbox_messages, email_accounts, users CASCADE`
})
```

## Auth Integration Test Template

```typescript
// tests/integration/auth.test.ts
import { describe, it, expect } from 'vitest'
import { buildApp } from '../../apps/api/src/app'

describe('POST /api/auth/register', () => {
  it('should create user and return tokens', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test@yandex.ru', password: 'SecurePass123', fullName: 'Тест' }
    })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.accessToken).toBeDefined()
    expect(body.refreshToken).toBeDefined()
  })

  it('should return 409 on duplicate email', async () => {
    // ... seed user → attempt duplicate register → expect 409
  })
})
```

## YooKassa Webhook Test

```typescript
// tests/integration/billing/webhook.test.ts
import { createHmac } from 'crypto'

function makeWebhookSignature(body: object, secret: string): string {
  const raw = JSON.stringify(body)
  const hmac = createHmac('sha256', secret).update(raw).digest('base64')
  return `SHA-256=${hmac}`
}

it('should activate subscription on payment.succeeded', async () => {
  const event = { event: 'payment.succeeded', object: { id: 'pay_123', metadata: { subscriptionId: sub.id } } }
  const digest = makeWebhookSignature(event, process.env.YOOKASSA_WEBHOOK_SECRET!)

  const res = await app.inject({
    method: 'POST',
    url: '/api/billing/webhook',
    headers: { 'Digest': digest },
    payload: event,
  })

  expect(res.statusCode).toBe(200)
  const updatedSub = await prisma.subscription.findUnique({ where: { id: sub.id } })
  expect(updatedSub!.status).toBe('active')
})
```

## Playwright E2E Pattern

```typescript
// tests/e2e/warmup.spec.ts
import { test, expect } from '@playwright/test'

test('warmup start flow', async ({ page }) => {
  await page.goto('/dashboard/accounts')
  await page.click('[data-testid="connect-account"]')
  // fill form...
  await page.click('[data-testid="start-warmup"]')
  await expect(page.locator('[data-testid="warmup-status"]')).toHaveText('Прогрев')
  // Wait for inbox score to appear
  await expect(page.locator('[data-testid="inbox-score"]')).toBeVisible({ timeout: 60000 })
})
```

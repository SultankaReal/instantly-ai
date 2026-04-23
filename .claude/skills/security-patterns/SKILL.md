---
name: security-patterns
description: >
  Security implementation patterns for Inkflow. JWT auth middleware, webhook signature
  verification (Stripe + Postmark), rate limiting, Zod validation, and bcrypt patterns.
  Load when implementing any authentication, payment, or webhook endpoint.
version: "1.0"
maturity: production
---

# Security Patterns — Inkflow

## JWT Authentication Middleware (Fastify)

```typescript
// apps/api/src/plugins/auth.ts
import { FastifyInstance, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(jwt, { secret: process.env.JWT_SECRET! })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      // Check Redis blacklist for logged-out tokens
      const isBlacklisted = await fastify.redis.get(`blacklist:${request.user.jti}`)
      if (isBlacklisted) {
        return reply.status(401).send({ error: 'Token revoked' })
      }
    } catch (err) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})
```

## Stripe Webhook Verification

```typescript
// apps/api/src/services/stripe-webhook.service.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-11-20.acacia' })

export async function verifyAndProcessStripeWebhook(
  rawBody: Buffer,
  signature: string
): Promise<void> {
  let event: Stripe.Event

  try {
    // CRITICAL: rawBody must be Buffer, not string or parsed JSON
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    throw new Error('Invalid Stripe webhook signature')
  }

  // TODO: Add idempotency check before processing
  // await checkAndRecordEventId(event.id)  // Prevents duplicate processing

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // SECURITY: Always validate ownership server-side
      const publicationId = session.metadata?.publication_id
      if (!publicationId) throw new Error('Missing publication_id in metadata')
      // Verify publication belongs to the Stripe account
      await activatePaidSubscription(session)
      break
    }
    case 'invoice.payment_failed': {
      await handlePaymentFailure(event.data.object as Stripe.Invoice)
      break
    }
    case 'customer.subscription.deleted': {
      await handleSubscriptionCanceled(event.data.object as Stripe.Subscription)
      break
    }
  }
}
```

## Postmark Webhook Verification

```typescript
// apps/api/src/services/postmark-webhook.service.ts
import crypto from 'crypto'

export function verifyPostmarkSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64')
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'base64'),
    Buffer.from(expectedSignature, 'base64')
  )
}

// In route handler:
fastify.post('/api/webhooks/postmark', async (request, reply) => {
  const signature = request.headers['x-postmark-signature'] as string
  const isValid = verifyPostmarkSignature(
    JSON.stringify(request.body),
    signature,
    process.env.POSTMARK_WEBHOOK_SECRET!
  )
  if (!isValid) return reply.status(401).send({ error: 'Invalid signature' })
  // Process event...
})
```

## Redis Rate Limiting Pattern

```typescript
// apps/api/src/plugins/rate-limit.ts
import { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'

export async function setupRateLimit(fastify: FastifyInstance) {
  await fastify.register(rateLimit, {
    max: 100,     // anonymous
    timeWindow: '1 minute',
    redis: fastify.redis,
    keyGenerator: (req) => req.user?.id || req.ip,  // auth users use userId
    skipOnError: false,
  })

  // Override for authenticated endpoints
  fastify.addHook('onRoute', (routeOptions) => {
    if (routeOptions.url.startsWith('/api/ai/')) {
      routeOptions.config = {
        rateLimit: { max: 10, timeWindow: '1 hour' }  // AI endpoints
      }
    } else if (routeOptions.config?.auth) {
      routeOptions.config.rateLimit = { max: 1000, timeWindow: '1 minute' }
    }
  })
}
```

## HMAC Unsubscribe Token

```typescript
// Generates tamper-proof unsubscribe token
export function generateUnsubscribeToken(subscriberId: string): string {
  return crypto
    .createHmac('sha256', process.env.UNSUBSCRIBE_SECRET!)
    .update(subscriberId)
    .digest('hex')
}

export function verifyUnsubscribeToken(subscriberId: string, token: string): boolean {
  const expected = generateUnsubscribeToken(subscriberId)
  return crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
}
```

## bcrypt Password Pattern

```typescript
import bcrypt from 'bcrypt'

const BCRYPT_ROUNDS = 12  // Never lower than 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

## Server-Side Content Truncation (Paywall)

```typescript
// CRITICAL: This MUST happen server-side, not just frontend CSS
export function truncateContent(html: string, percentVisible: number = 0.2): string {
  // Find word count
  const textContent = html.replace(/<[^>]+>/g, '')
  const words = textContent.split(/\s+/)
  const visibleWordCount = Math.floor(words.length * percentVisible)

  // Find nearest </p> boundary after visible word count
  let wordCount = 0
  let truncateIndex = 0
  const paragraphRegex = /<\/p>/g
  let match: RegExpExecArray | null

  while ((match = paragraphRegex.exec(html)) !== null) {
    const textUpToHere = html.slice(0, match.index).replace(/<[^>]+>/g, '')
    wordCount = textUpToHere.split(/\s+/).length
    if (wordCount >= visibleWordCount) {
      truncateIndex = match.index + match[0].length
      break
    }
  }

  return truncateIndex > 0 ? html.slice(0, truncateIndex) : html.slice(0, html.length * percentVisible)
}
```

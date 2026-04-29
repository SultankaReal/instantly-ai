---
name: security-patterns
description: Security implementation patterns for Поток — JWT/Redis blacklist, AES-256-GCM credential storage, YooKassa HMAC webhook verification, 38-ФЗ unsubscribe token, bcrypt, rate limiting.
version: "1.0"
maturity: production
---

# Security Patterns — Поток

## JWT Authentication Pattern

```typescript
// Fastify plugin: apps/api/src/plugins/auth.ts
import fp from 'fastify-plugin'
import jwt from '@fastify/jwt'

export const authPlugin = fp(async (fastify) => {
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: '15m' }
  })

  fastify.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify()
      // Check blacklist
      const isRevoked = await fastify.redis.get(`blacklist:${request.token}`)
      if (isRevoked) return reply.code(401).send({ error: 'token_revoked' })
    } catch (err) {
      reply.code(401).send({ error: 'token_expired' })
    }
  })
})
```

## bcrypt Pattern

```typescript
import bcrypt from 'bcryptjs'

const BCRYPT_COST = 12  // NEVER lower than 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
```

## Refresh Token Rotation

```typescript
// Store on login
await redis.set(
  `refresh:${userId}:${refreshToken}`,
  '1',
  { EX: 7 * 24 * 3600 }
)

// Verify on refresh
const exists = await redis.get(`refresh:${userId}:${refreshToken}`)
if (!exists) throw new UnauthorizedError('token_revoked')

// Blacklist on logout
await redis.del(`refresh:${userId}:${refreshToken}`)
```

## Rate Limiting Pattern

```typescript
// apps/api/src/plugins/rate-limit.ts
await fastify.register(import('@fastify/rate-limit'), {
  global: true,
  max: 100,
  timeWindow: '1 minute',
  keyGenerator: (request) => request.ip,

  // Override per route group
  // Authenticated: 1000/min per userId
  // AI generation: 10/hr per userId
})
```

## 38-ФЗ Unsubscribe Token

```typescript
import { createHmac } from 'crypto'

export function generateUnsubscribeToken(email: string): string {
  const hmac = createHmac('sha256', process.env.ENCRYPTION_KEY!)
  hmac.update(email)
  return hmac.digest('hex')
}

export function verifyUnsubscribeToken(token: string, email: string): boolean {
  const expected = generateUnsubscribeToken(email)
  return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))
}

export function appendUnsubscribeLink(html: string, contactEmail: string, baseUrl: string): string {
  const token = generateUnsubscribeToken(contactEmail)
  const link = `${baseUrl}/unsubscribe?token=${token}&email=${encodeURIComponent(contactEmail)}`
  return html + `\n<p style="font-size:12px;color:#999;">
    <a href="${link}">Отписаться от рассылки</a>
  </p>`
}
```

## DOMPurify Server-Side

```typescript
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target'],
  })
}
```

## Multi-tenant Query Pattern

```typescript
// ALWAYS include userId in queries — never trust client-provided IDs alone
async function getAccount(accountId: string, userId: string) {
  const account = await prisma.emailAccount.findFirst({
    where: { id: accountId, userId },  // Both conditions required
    select: { id: true, email: true, status: true }
    // NOTE: never select credentialsEnc in list endpoints
  })
  if (!account) throw new NotFoundError()  // 404, not 403 — don't reveal existence
  return account
}
```

---
name: coding-standards
description: Fastify v5, Next.js 15, Prisma 5, BullMQ, Nodemailer/imapflow coding patterns for Поток. Provides concrete code templates and anti-patterns for the monorepo tech stack.
version: "1.0"
maturity: production
---

# Coding Standards — Поток

## Fastify v5 Route Pattern

```typescript
// apps/api/src/routes/accounts/index.ts
import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { AccountService } from '../../services/account.service'

const CreateAccountSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  imapHost: z.string(),
  imapPort: z.number().int(),
})

export const accountsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/accounts', {
    onRequest: [fastify.authenticate],
    schema: { body: zodToJsonSchema(CreateAccountSchema) },
  }, async (request, reply) => {
    const data = CreateAccountSchema.parse(request.body)
    const account = await AccountService.create(request.user.id, data)
    return reply.code(201).send(account)
  })
}
```

## Prisma Transaction Pattern

```typescript
// For multi-step operations: always use $transaction
const result = await prisma.$transaction(async (tx) => {
  const account = await tx.emailAccount.create({
    data: { userId, email, credentialsEnc }
  })
  await tx.warmupEvent.create({
    data: { accountId: account.id, eventType: 'connected' }
  })
  return account
})
```

## BullMQ Processor Pattern

```typescript
// apps/worker/src/processors/warmup-send.processor.ts
import { Worker, Job } from 'bullmq'
import { WarmupSendJob } from '@potok/shared-types'

export const warmupWorker = new Worker<WarmupSendJob>(
  'warmup-send',
  async (job: Job<WarmupSendJob>) => {
    const { accountId, partnerId } = job.data

    // Always load accounts fresh — don't cache decrypted creds
    const senderAccount = await db.emailAccounts.findById(accountId)
    const partnerAccount = await db.emailAccounts.findById(partnerId)
    const senderCreds = await decryptAES256GCM(senderAccount.credentialsEnc, ENCRYPTION_KEY)
    const partnerCreds = await decryptAES256GCM(partnerAccount.credentialsEnc, ENCRYPTION_KEY)

    // ... process
  },
  { connection: redisConnection, concurrency: 5 }
)
```

## AES-256-GCM Pattern

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export async function encryptAES256GCM(data: string, keyHex: string): Promise<Buffer> {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted])  // iv(12) + tag(16) + ciphertext
}

export async function decryptAES256GCM(data: Buffer, keyHex: string): Promise<string> {
  const key = Buffer.from(keyHex, 'hex')
  const iv = data.subarray(0, 12)
  const tag = data.subarray(12, 28)
  const ciphertext = data.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}
```

## YooKassa Webhook Verification

```typescript
import { createHmac, timingSafeEqual } from 'crypto'

export function verifyYooKassaWebhook(body: Buffer, digestHeader: string): boolean {
  const secret = process.env.YOOKASSA_WEBHOOK_SECRET!
  const computed = createHmac('sha256', secret).update(body).digest('base64')
  const expected = digestHeader.replace('SHA-256=', '')
  return timingSafeEqual(Buffer.from(computed), Buffer.from(expected))
}
```

## Zod Schema → Fastify Pattern

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema'

fastify.post('/route', {
  schema: {
    body: zodToJsonSchema(MyZodSchema),
    response: {
      200: zodToJsonSchema(ResponseSchema),
      400: zodToJsonSchema(ErrorSchema),
    }
  }
})
```

## imapflow Pattern

```typescript
import { ImapFlow } from 'imapflow'

async function checkInbox(creds: EmailCreds): Promise<string[]> {
  const client = new ImapFlow({
    host: creds.imapHost,
    port: creds.imapPort,
    secure: true,
    auth: { user: creds.email, pass: creds.password }
  })
  await client.connect()
  try {
    await client.mailboxOpen('INBOX')
    // ... operations
    return uids
  } finally {
    await client.logout()  // Always close
  }
}
```

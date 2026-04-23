---
name: coding-standards
description: >
  Inkflow-specific coding patterns for Fastify, Next.js 15 App Router, Prisma, BullMQ,
  and React Email. Load when writing new code to ensure correct patterns are applied.
  Prevents common mistakes specific to this tech stack combination.
version: "1.0"
maturity: production
---

# Coding Standards — Inkflow

## Fastify Route Pattern

```typescript
// apps/api/src/routes/posts.ts
import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { SendPostSchema } from '@inkflow/shared-types'
import { sendPost } from '../services/send-post.service'

export async function postsRoutes(fastify: FastifyInstance) {
  fastify.post<{ Params: { id: string } }>(
    '/:id/send',
    {
      preHandler: [fastify.authenticate],  // JWT middleware
      schema: {
        params: SendPostSchema.params,
        response: { 200: SendPostSchema.response }
      }
    },
    async (request, reply) => {
      const { id } = request.params
      const { userId } = request.user  // from JWT
      await sendPost(id, userId)
      return reply.send({ success: true })
    }
  )
}
```

## Prisma Service Pattern

```typescript
// apps/api/src/services/subscriber.service.ts
import { prisma } from '../plugins/db'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

export async function subscribe(
  publicationId: string,
  email: string
): Promise<{ created: boolean }> {
  try {
    await prisma.subscriber.upsert({
      where: { publication_id_email: { publication_id: publicationId, email } },
      create: {
        publication_id: publicationId,
        email,
        status: 'pending_confirmation',
        tier: 'free',
      },
      update: {} // No update on conflict for existing subscribers
    })
    return { created: true }
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
      return { created: false }  // Already subscribed
    }
    throw error
  }
}
```

## Next.js Server Component + SEO Pattern

```typescript
// apps/web/src/app/[slug]/posts/[postSlug]/page.tsx
import { Metadata } from 'next'
import { getPost } from '@/lib/api-client'

interface Props {
  params: { slug: string; postSlug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await getPost(params.slug, params.postSlug)
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.sent_at,
    },
    twitter: { card: 'summary_large_image', title: post.title },
  }
}

export default async function PostPage({ params }: Props) {
  const post = await getPost(params.slug, params.postSlug)
  // Server Component — no 'use client' needed
  return <article dangerouslySetInnerHTML={{ __html: post.content_html }} />
}
```

## BullMQ Worker Pattern

```typescript
// apps/worker/src/workers/email-send.worker.ts
import { Worker, Job } from 'bullmq'
import { EmailBatch } from '@inkflow/shared-types'
import { connection } from '../queues'

export const emailWorker = new Worker<EmailBatch>(
  'email-send',
  async (job: Job<EmailBatch>) => {
    const { postId, recipients } = job.data

    // Idempotency: check if already sent
    const existing = await prisma.emailSend.findMany({
      where: { post_id: postId, subscriber_id: { in: recipients.map(r => r.id) }, status: 'sent' }
    })
    const alreadySent = new Set(existing.map(e => e.subscriber_id))
    const toSend = recipients.filter(r => !alreadySent.has(r.id))

    if (toSend.length === 0) return  // Already processed

    await postmarkClient.sendEmailBatch(toSend.map(r => ({ /* ... */ })))
  },
  {
    connection,
    concurrency: 2,
    attempts: 5,
    backoff: { type: 'exponential', delay: 60000 }
  }
)
```

## Webhook Handler Pattern (Stripe)

```typescript
// apps/api/src/routes/webhooks.ts
fastify.post('/stripe/webhook', {
  config: { rawBody: true }  // Fastify raw body plugin required
}, async (request, reply) => {
  const sig = request.headers['stripe-signature'] as string
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(request.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    return reply.status(400).send({ error: 'Invalid signature' })
  }

  // Idempotency guard (TODO: implement before production)
  // await checkStripeEventIdempotency(event.id)

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
      break
    // ...
  }

  return reply.send({ received: true })
})
```

## React Email Template Pattern

```typescript
// packages/email-templates/src/confirmation.tsx
import { Html, Button, Text, Section } from '@react-email/components'

interface ConfirmationEmailProps {
  publicationName: string
  confirmationUrl: string
}

export function ConfirmationEmail({ publicationName, confirmationUrl }: ConfirmationEmailProps) {
  return (
    <Html>
      <Section>
        <Text>Confirm your subscription to {publicationName}</Text>
        <Button href={confirmationUrl}>Confirm subscription</Button>
        <Text>Link expires in 48 hours.</Text>
      </Section>
    </Html>
  )
}
```

## Zod Schema Pattern (Shared Types)

```typescript
// packages/shared-types/src/schemas/subscriber.ts
import { z } from 'zod'

export const SubscriberStatusSchema = z.enum([
  'pending_confirmation', 'active', 'unsubscribed', 'bounced', 'spam'
])

export const SubscriberTierSchema = z.enum(['free', 'paid', 'trial', 'past_due'])

export const SubscribeRequestSchema = z.object({
  email: z.string().email().max(255),
})

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>
```

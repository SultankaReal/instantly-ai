import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from '../lib/errors.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'agency']),
  period: z.enum(['monthly', 'annual']).default('monthly'),
})

// ---------------------------------------------------------------------------
// Pricing (in kopecks)
// ---------------------------------------------------------------------------

const PRICES: Record<string, Record<string, number>> = {
  starter: { monthly: 199000, annual: 159000 },
  pro:     { monthly: 499000, annual: 399000 },
  agency:  { monthly: 999000, annual: 799000 },
}

function getPlanAmount(plan: string, period: string): number {
  const planPrices = PRICES[plan]
  if (!planPrices) throw new BadRequestError('invalid_plan')
  const amount = planPrices[period]
  if (amount === undefined) throw new BadRequestError('invalid_period')
  return amount
}

// ---------------------------------------------------------------------------
// YooKassa signature verification
// ---------------------------------------------------------------------------

function verifyYooKassaSignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env['YOOKASSA_WEBHOOK_SECRET']
  if (!secret) {
    throw new Error('YOOKASSA_WEBHOOK_SECRET is not configured')
  }

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expected, 'utf8'),
    )
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const billingRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/billing/checkout (authenticated)
  fastify.post(
    '/checkout',
    { preHandler: fastify.authenticate },
    async (request, _reply) => {
      const body = checkoutSchema.safeParse(request.body)
      if (!body.success) {
        throw new BadRequestError('validation_error', body.error.message)
      }

      const userId = request.user.id
      const user = await fastify.prisma.user.findUnique({ where: { id: userId } })
      if (!user) throw new NotFoundError('user_not_found')

      const { plan, period } = body.data
      const amount = getPlanAmount(plan, period)

      const appUrl = process.env['APP_URL'] ?? 'https://app.potok.io'
      const yookassaShopId = process.env['YOOKASSA_SHOP_ID']
      const yookassaSecret = process.env['YOOKASSA_SECRET_KEY']

      if (!yookassaShopId || !yookassaSecret) {
        throw new Error('YooKassa credentials are not configured')
      }

      // Create YooKassa payment via REST API
      const idempotenceKey = `checkout-${userId}-${Date.now()}`

      const paymentBody = {
        amount: {
          value: (amount / 100).toFixed(2),
          currency: 'RUB',
        },
        payment_method_type: 'bank_card',
        confirmation: {
          type: 'redirect',
          return_url: `${appUrl}/billing/success?plan=${plan}&period=${period}`,
        },
        save_payment_method: true,
        description: `Поток ${plan.charAt(0).toUpperCase()}${plan.slice(1)} — ${user.email}`,
        metadata: { userId, plan, period },
      }

      const credentials = Buffer.from(`${yookassaShopId}:${yookassaSecret}`).toString('base64')

      const response = await fetch('https://api.yookassa.ru/v3/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
          'Idempotence-Key': idempotenceKey,
        },
        body: JSON.stringify(paymentBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        fastify.log.error({ status: response.status, error: errorText }, 'YooKassa payment creation failed')
        throw new BadRequestError('payment_creation_failed', 'Failed to create payment')
      }

      const payment = (await response.json()) as {
        id: string
        confirmation: { confirmation_url: string }
      }

      return {
        paymentUrl: payment.confirmation.confirmation_url,
        paymentId: payment.id,
      }
    },
  )

  // POST /api/billing/webhook (no auth — uses signature verification)
  fastify.post('/webhook', async (request, reply) => {
    const signature = request.headers['x-yookassa-signature'] as string | undefined

    if (!signature) {
      throw new UnauthorizedError('missing_signature', 'X-YooKassa-Signature header is required')
    }

    const rawBody = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.from(JSON.stringify(request.body))

    // ALWAYS verify signature before any DB write
    const isValid = verifyYooKassaSignature(rawBody, signature)
    if (!isValid) {
      throw new UnauthorizedError('invalid_signature', 'Webhook signature verification failed')
    }

    const event = typeof request.body === 'string'
      ? JSON.parse(request.body)
      : request.body as {
          event: string
          object: {
            id: string
            amount: { value: string }
            metadata: { userId: string; plan: string; period: string }
            payment_method?: { id: string }
          }
        }

    // Idempotency: skip if already processed
    const existing = await fastify.prisma.paymentEvent.findUnique({
      where: { yookassaEventId: event.object.id },
    })

    if (existing) {
      return reply.send({ ok: true })
    }

    const userId = event.object.metadata?.userId
    if (!userId) {
      fastify.log.warn({ event: event.event }, 'YooKassa webhook missing userId in metadata')
      return reply.send({ ok: true })
    }

    // Record event for audit trail
    await fastify.prisma.paymentEvent.create({
      data: {
        userId,
        eventType: event.event,
        yookassaEventId: event.object.id,
        amount: Math.round(parseFloat(event.object.amount?.value ?? '0') * 100),
        payload: event,
      },
    })

    // Process by event type
    switch (event.event) {
      case 'payment.succeeded':
        await handlePaymentSucceeded(fastify, event.object)
        break
      case 'payment.canceled':
        fastify.log.info({ paymentId: event.object.id }, 'Payment canceled')
        break
      case 'refund.succeeded':
        fastify.log.info({ paymentId: event.object.id }, 'Refund processed')
        break
      default:
        fastify.log.info({ event: event.event }, 'Unhandled YooKassa event')
    }

    return reply.send({ ok: true })
  })

  // GET /api/billing/subscription (authenticated)
  fastify.get(
    '/subscription',
    { preHandler: fastify.authenticate },
    async (request, _reply) => {
      const subscription = await fastify.prisma.subscription.findUnique({
        where: { userId: request.user.id },
      })

      if (!subscription) {
        return { subscription: null }
      }

      return { subscription }
    },
  )

  // POST /api/billing/cancel (authenticated)
  fastify.post(
    '/cancel',
    { preHandler: fastify.authenticate },
    async (request, _reply) => {
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          userId: request.user.id,
          status: 'active',
        },
      })

      if (!subscription) {
        throw new NotFoundError('no_active_subscription', 'No active subscription found')
      }

      await fastify.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
        },
      })

      // TODO: enqueue downgrade job at currentPeriodEnd
      // await downgradePlanQueue.add({ userId: request.user.id, newPlan: 'free' }, {
      //   delay: subscription.currentPeriodEnd.getTime() - Date.now()
      // })

      return {
        ok: true,
        accessUntil: subscription.currentPeriodEnd?.toISOString() ?? null,
        message: 'Subscription cancelled. Access continues until end of current period.',
      }
    },
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function handlePaymentSucceeded(
  fastify: import('fastify').FastifyInstance,
  payment: {
    id: string
    amount: { value: string }
    metadata: { userId: string; plan: string; period: string }
    payment_method?: { id: string }
  },
): Promise<void> {
  const { userId, plan, period } = payment.metadata

  const now = new Date()
  const periodEnd = period === 'annual'
    ? new Date(now.getTime() + 365 * 24 * 3600 * 1000)
    : new Date(now.getTime() + 30 * 24 * 3600 * 1000)

  await fastify.prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      status: 'active',
      yookassaPaymentId: payment.id,
      yookassaPaymentMethodId: payment.payment_method?.id ?? null,
      amount: Math.round(parseFloat(payment.amount.value) * 100),
      billingPeriod: period,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan,
      status: 'active',
      yookassaPaymentId: payment.id,
      yookassaPaymentMethodId: payment.payment_method?.id ?? null,
      amount: Math.round(parseFloat(payment.amount.value) * 100),
      billingPeriod: period,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelledAt: null,
      renewalAttempts: 0,
    },
  })

  await fastify.prisma.user.update({
    where: { id: userId },
    data: { plan, trialEndsAt: null },
  })

  fastify.log.info({ userId, plan, period }, 'Payment succeeded — subscription activated')
}

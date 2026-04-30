import { Job } from 'bullmq'
import { prisma } from '../lib/prisma'

type RecurringBillingJob = Record<string, never>

type YooKassaPaymentResponse = {
  id: string
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled'
  confirmation?: {
    confirmation_url: string
  }
}

async function createYooKassaPayment(options: {
  amount: { value: string; currency: string }
  paymentMethodId: string
  capture: boolean
  description: string
  metadata: Record<string, string>
  idempotenceKey: string
}): Promise<YooKassaPaymentResponse> {
  const shopId = process.env['YOOKASSA_SHOP_ID']!
  const secretKey = process.env['YOOKASSA_SECRET_KEY']!
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString('base64')

  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
      'Idempotence-Key': options.idempotenceKey,
    },
    body: JSON.stringify({
      amount: options.amount,
      payment_method_id: options.paymentMethodId,
      capture: options.capture,
      description: options.description,
      metadata: options.metadata,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`YooKassa API error ${response.status}: ${errorBody}`)
  }

  return response.json() as Promise<YooKassaPaymentResponse>
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]!
}

export async function billingProcessor(_job: Job<RecurringBillingJob>): Promise<void> {
  // Find subscriptions due for renewal (within next 24h)
  const now = new Date()
  const renewalWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status: 'active',
      currentPeriodEnd: { lte: renewalWindow },
      yookassaPaymentMethodId: { not: null },
    },
    include: {
      user: { select: { id: true, email: true, plan: true } },
    },
  })

  for (const sub of dueSubscriptions) {
    // Always persist renewalAttempts BEFORE branching
    const currentAttempts = sub.renewalAttempts ?? 0

    try {
      // Attempt YooKassa payment with saved payment_method_id
      await createYooKassaPayment({
        amount: {
          value: (sub.amount / 100).toFixed(2),
          currency: 'RUB',
        },
        paymentMethodId: sub.yookassaPaymentMethodId!,
        capture: true,
        description: `Поток ${sub.plan} — renewal`,
        metadata: {
          userId: sub.userId,
          plan: sub.plan,
          period: sub.billingPeriod,
          subscriptionId: sub.id,
        },
        idempotenceKey: `renewal-${sub.id}-${formatDate(now)}`,
      })

      // On success: extend period by 1 month (webhook will confirm, but we optimistically update)
      const periodBase = sub.currentPeriodEnd ?? now
      const nextPeriodEnd =
        sub.billingPeriod === 'annual'
          ? new Date(periodBase.getTime() + 365 * 24 * 60 * 60 * 1000)
          : new Date(periodBase.getTime() + 30 * 24 * 60 * 60 * 1000)

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          renewalAttempts: 0,
          renewalAttemptAt: now,
          currentPeriodStart: sub.currentPeriodEnd,
          currentPeriodEnd: nextPeriodEnd,
        },
      })
    } catch {
      // Always persist attempt count BEFORE branching
      const newAttempts = currentAttempts + 1

      if (newAttempts >= 3) {
        // 3 failures → set status = 'past_due', users.plan = 'free'
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            status: 'past_due',
            renewalAttempts: newAttempts,
            renewalAttemptAt: now,
          },
        })

        await prisma.user.update({
          where: { id: sub.userId },
          data: { plan: 'free' },
        })
      } else {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            renewalAttempts: newAttempts,
            renewalAttemptAt: now,
          },
        })
      }
    }
  }
}

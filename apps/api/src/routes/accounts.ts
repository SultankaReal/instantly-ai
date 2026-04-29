import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js'
import { encryptAES256GCM } from '../lib/crypto.js'

// ---------------------------------------------------------------------------
// Plan limits
// ---------------------------------------------------------------------------

const PLAN_LIMITS: Record<string, { accounts: number }> = {
  trial:   { accounts: 1 },
  free:    { accounts: 0 },
  starter: { accounts: 3 },
  pro:     { accounts: Infinity },
  agency:  { accounts: Infinity },
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const connectAccountSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  smtpHost: z.string().min(1),
  smtpPort: z.number().int().min(1).max(65535).default(465),
  imapHost: z.string().min(1),
  imapPort: z.number().int().min(1).max(65535).default(993),
  password: z.string().min(1),
})

// Strip sensitive fields from account response
function sanitizeAccount(account: Record<string, unknown>): Record<string, unknown> {
  const { credentialsEnc: _enc, ...rest } = account
  return rest
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const accountsRoutes: FastifyPluginAsync = async (fastify) => {
  // All routes require authentication
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/accounts
  fastify.get('/', async (request, _reply) => {
    const accounts = await fastify.prisma.emailAccount.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        imapHost: true,
        imapPort: true,
        status: true,
        inboxScore: true,
        dailyLimit: true,
        inWarmupPool: true,
        warmupStartedAt: true,
        lastScannedAt: true,
        dnsSpf: true,
        dnsDkim: true,
        dnsDmarc: true,
        dnsCheckedAt: true,
        createdAt: true,
      },
    })

    return { accounts }
  })

  // POST /api/accounts
  fastify.post('/', async (request, reply) => {
    const body = connectAccountSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    const userId = request.user.id
    const user = await fastify.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('user_not_found')

    // Enforce plan limits
    const currentCount = await fastify.prisma.emailAccount.count({
      where: {
        userId,
        status: { not: 'error' },
      },
    })

    const limit = PLAN_LIMITS[user.plan]?.accounts ?? 0
    if (currentCount >= limit) {
      throw new ForbiddenError(
        'plan_limit_exceeded',
        `Your plan allows ${limit} email account(s). Upgrade to add more.`,
      )
    }

    const { email, displayName, smtpHost, smtpPort, imapHost, imapPort, password } = body.data

    // Encrypt credentials
    const encryptionKey = process.env['ENCRYPTION_KEY']
    if (!encryptionKey) throw new Error('ENCRYPTION_KEY is not configured')

    const credentialsEnc = encryptAES256GCM(
      JSON.stringify({ email, password }),
      encryptionKey,
    )

    // Create account (SMTP/IMAP test is done by the worker asynchronously)
    const account = await fastify.prisma.emailAccount.create({
      data: {
        userId,
        email,
        displayName: displayName ?? null,
        smtpHost,
        smtpPort,
        imapHost,
        imapPort,
        credentialsEnc,
        status: 'connected',
        inboxScore: 0,
        dailyLimit: 50,
        inWarmupPool: false,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        imapHost: true,
        imapPort: true,
        status: true,
        inboxScore: true,
        dailyLimit: true,
        inWarmupPool: true,
        warmupStartedAt: true,
        dnsSpf: true,
        dnsDkim: true,
        dnsDmarc: true,
        createdAt: true,
      },
    })

    // TODO: enqueue DNS check job
    // await bullmq.dnsCheckQueue.add('check-dns', { accountId: account.id })

    return reply.code(201).send({ account })
  })

  // GET /api/accounts/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const account = await fastify.prisma.emailAccount.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id, // multi-tenant isolation
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        imapHost: true,
        imapPort: true,
        status: true,
        inboxScore: true,
        dailyLimit: true,
        inWarmupPool: true,
        warmupStartedAt: true,
        lastScannedAt: true,
        dnsSpf: true,
        dnsDkim: true,
        dnsDmarc: true,
        dnsCheckedAt: true,
        createdAt: true,
      },
    })

    if (!account) throw new NotFoundError('account_not_found')

    return { account }
  })

  // DELETE /api/accounts/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    // Verify ownership first
    const account = await fastify.prisma.emailAccount.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    })

    if (!account) throw new NotFoundError('account_not_found')

    await fastify.prisma.emailAccount.delete({
      where: { id: account.id },
    })

    return reply.code(204).send()
  })

  // POST /api/accounts/:id/warmup/start
  fastify.post<{ Params: { id: string } }>(
    '/:id/warmup/start',
    async (request, _reply) => {
      const account = await fastify.prisma.emailAccount.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
      })

      if (!account) throw new NotFoundError('account_not_found')

      // Idempotent
      if (account.status === 'warming') {
        return { account: sanitizeAccount(account as unknown as Record<string, unknown>) }
      }

      const updated = await fastify.prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          status: 'warming',
          inWarmupPool: true,
          warmupStartedAt: new Date(),
        },
        select: {
          id: true,
          email: true,
          status: true,
          inWarmupPool: true,
          warmupStartedAt: true,
          inboxScore: true,
        },
      })

      // TODO: schedule first warmup jobs
      // await bullmq.warmupQueue.add('schedule', { accountId: account.id })

      return { account: updated }
    },
  )

  // POST /api/accounts/:id/warmup/stop
  fastify.post<{ Params: { id: string } }>(
    '/:id/warmup/stop',
    async (request, _reply) => {
      const account = await fastify.prisma.emailAccount.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
      })

      if (!account) throw new NotFoundError('account_not_found')

      const updated = await fastify.prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          status: 'paused',
          inWarmupPool: false,
        },
        select: {
          id: true,
          email: true,
          status: true,
          inWarmupPool: true,
          inboxScore: true,
        },
      })

      return { account: updated }
    },
  )

  // GET /api/accounts/:id/score
  fastify.get<{ Params: { id: string } }>(
    '/:id/score',
    async (request, _reply) => {
      const account = await fastify.prisma.emailAccount.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
        select: {
          id: true,
          email: true,
          inboxScore: true,
          status: true,
          dnsSpf: true,
          dnsDkim: true,
          dnsDmarc: true,
          dnsCheckedAt: true,
        },
      })

      if (!account) throw new NotFoundError('account_not_found')

      const score = account.inboxScore
      const color =
        score >= 80 ? 'green' : score >= 60 ? 'yellow' : 'red'

      return {
        accountId: account.id,
        score,
        color,
        dns: {
          spf: account.dnsSpf,
          dkim: account.dnsDkim,
          dmarc: account.dnsDmarc,
          checkedAt: account.dnsCheckedAt,
        },
      }
    },
  )

  // GET /api/accounts/:id/score/history
  fastify.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
    '/:id/score/history',
    async (request, _reply) => {
      // Verify ownership
      const account = await fastify.prisma.emailAccount.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
        select: { id: true },
      })

      if (!account) throw new NotFoundError('account_not_found')

      const limit = Math.min(
        parseInt(request.query.limit ?? '30', 10),
        100,
      )

      const snapshots = await fastify.prisma.inboxScoreSnapshot.findMany({
        where: { accountId: account.id },
        orderBy: { snapshottedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          score: true,
          provider: true,
          snapshottedAt: true,
        },
      })

      return { snapshots }
    },
  )
}

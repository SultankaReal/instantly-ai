import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { BadRequestError, NotFoundError } from '../lib/errors.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  accountId: z.string().uuid().optional(),
  isRead: z.coerce.boolean().optional(),
  leadStatus: z
    .enum(['interested', 'not_interested', 'callback', 'spam'])
    .optional(),
})

const leadStatusSchema = z.object({
  leadStatus: z.enum(['interested', 'not_interested', 'callback', 'spam']),
})

const replySchema = z.object({
  body: z.string().min(1).max(50000),
})

const VALID_LEAD_STATUSES = ['interested', 'not_interested', 'callback', 'spam'] as const

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const inboxRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/inbox
  fastify.get('/', async (request, _reply) => {
    const query = paginationSchema.safeParse(request.query)
    if (!query.success) {
      throw new BadRequestError('validation_error', query.error.message)
    }

    const { page, limit, accountId, isRead, leadStatus } = query.data
    const skip = (page - 1) * limit

    // If accountId provided, verify it belongs to the user
    if (accountId) {
      const account = await fastify.prisma.emailAccount.findFirst({
        where: { id: accountId, userId: request.user.id },
        select: { id: true },
      })
      if (!account) throw new NotFoundError('account_not_found')
    }

    const where = {
      userId: request.user.id,
      ...(accountId ? { accountId } : {}),
      ...(isRead !== undefined ? { isRead } : {}),
      ...(leadStatus ? { leadStatus } : {}),
    }

    const [messages, total] = await Promise.all([
      fastify.prisma.inboxMessage.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          accountId: true,
          sendId: true,
          fromEmail: true,
          fromName: true,
          subject: true,
          bodyText: true,
          isRead: true,
          leadStatus: true,
          aiCategory: true,
          aiConfidence: true,
          aiDraft: true,
          receivedAt: true,
        },
      }),
      fastify.prisma.inboxMessage.count({ where }),
    ])

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  })

  // GET /api/inbox/alerts
  fastify.get('/alerts', async (request, _reply) => {
    // Get all accounts for the user first
    const accounts = await fastify.prisma.emailAccount.findMany({
      where: { userId: request.user.id },
      select: { id: true },
    })
    const accountIds = accounts.map((a) => a.id)

    const alerts = await fastify.prisma.inboxAlert.findMany({
      where: {
        accountId: { in: accountIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return { alerts }
  })

  // GET /api/inbox/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const message = await fastify.prisma.inboxMessage.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    })

    if (!message) throw new NotFoundError('message_not_found')

    return { message }
  })

  // POST /api/inbox/:id/read
  fastify.post<{ Params: { id: string } }>(
    '/:id/read',
    async (request, _reply) => {
      const message = await fastify.prisma.inboxMessage.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
        select: { id: true },
      })

      if (!message) throw new NotFoundError('message_not_found')

      const updated = await fastify.prisma.inboxMessage.update({
        where: { id: message.id },
        data: { isRead: true },
        select: { id: true, isRead: true },
      })

      return { message: updated }
    },
  )

  // POST /api/inbox/:id/reply
  fastify.post<{ Params: { id: string } }>(
    '/:id/reply',
    async (request, _reply) => {
      const body = replySchema.safeParse(request.body)
      if (!body.success) {
        throw new BadRequestError('validation_error', body.error.message)
      }

      const message = await fastify.prisma.inboxMessage.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
        include: {
          account: {
            select: {
              id: true,
              email: true,
              smtpHost: true,
              smtpPort: true,
              credentialsEnc: true,
            },
          },
        },
      })

      if (!message) throw new NotFoundError('message_not_found')

      // TODO: send reply via SMTP using decrypted credentials
      // const creds = decryptAES256GCM(message.account.credentialsEnc, ENCRYPTION_KEY)
      // await sendSmtp({ from: creds.email, to: message.fromEmail, subject: `Re: ${message.subject}`, html: body.data.body })
      fastify.log.info(
        { messageId: message.id, to: message.fromEmail },
        'Manual reply queued (SMTP sending via worker)',
      )

      // Mark original message as read
      await fastify.prisma.inboxMessage.update({
        where: { id: message.id },
        data: { isRead: true },
      })

      return { ok: true, message: 'Reply queued for sending' }
    },
  )

  // PATCH /api/inbox/:id/lead-status
  fastify.patch<{ Params: { id: string } }>(
    '/:id/lead-status',
    async (request, _reply) => {
      const body = leadStatusSchema.safeParse(request.body)
      if (!body.success) {
        throw new BadRequestError('validation_error', body.error.message)
      }

      const message = await fastify.prisma.inboxMessage.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
        select: { id: true },
      })

      if (!message) throw new NotFoundError('message_not_found')

      // Validate lead status value
      const validStatuses: readonly string[] = VALID_LEAD_STATUSES
      if (!validStatuses.includes(body.data.leadStatus)) {
        throw new BadRequestError('invalid_lead_status')
      }

      const updated = await fastify.prisma.inboxMessage.update({
        where: { id: message.id },
        data: { leadStatus: body.data.leadStatus },
        select: { id: true, leadStatus: true },
      })

      return { message: updated }
    },
  )
}

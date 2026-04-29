import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../lib/errors.js'

// ---------------------------------------------------------------------------
// Plan limits
// ---------------------------------------------------------------------------

const PLAN_LIMITS: Record<string, { campaigns: number }> = {
  trial:   { campaigns: 1 },
  free:    { campaigns: 0 },
  starter: { campaigns: 5 },
  pro:     { campaigns: Infinity },
  agency:  { campaigns: Infinity },
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const campaignStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().min(1),
  delayDays: z.number().int().min(0).default(0),
})

const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  fromAccountId: z.string().uuid().optional(),
  scheduleDays: z
    .array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']))
    .default(['mon', 'tue', 'wed', 'thu', 'fri']),
  scheduleStart: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  scheduleEnd: z.string().regex(/^\d{2}:\d{2}$/).default('18:00'),
  timezone: z.string().default('Europe/Moscow'),
  dailyLimit: z.number().int().min(1).max(200).default(50),
  steps: z.array(campaignStepSchema).min(1),
})

const updateCampaignSchema = createCampaignSchema.partial().omit({ steps: true })

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const campaignsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  // GET /api/campaigns
  fastify.get('/', async (request, _reply) => {
    const campaigns = await fastify.prisma.campaign.findMany({
      where: { userId: request.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
          select: {
            id: true,
            stepNumber: true,
            subject: true,
            delayDays: true,
          },
        },
        _count: { select: { emailSends: true } },
      },
    })

    return { campaigns }
  })

  // POST /api/campaigns
  fastify.post('/', async (request, reply) => {
    const body = createCampaignSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    const userId = request.user.id
    const user = await fastify.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundError('user_not_found')

    // Enforce plan limits
    const currentCount = await fastify.prisma.campaign.count({
      where: {
        userId,
        status: { not: 'completed' },
      },
    })

    const limit = PLAN_LIMITS[user.plan]?.campaigns ?? 0
    if (currentCount >= limit) {
      throw new ForbiddenError(
        'plan_limit_exceeded',
        `Your plan allows ${limit} campaign(s). Upgrade to create more.`,
      )
    }

    // Verify fromAccountId belongs to user if provided
    if (body.data.fromAccountId) {
      const account = await fastify.prisma.emailAccount.findFirst({
        where: { id: body.data.fromAccountId, userId },
      })
      if (!account) throw new NotFoundError('account_not_found')
    }

    const { steps, ...campaignData } = body.data

    const campaign = await fastify.prisma.campaign.create({
      data: {
        ...campaignData,
        userId,
        steps: {
          create: steps.map((step) => ({
            stepNumber: step.stepNumber,
            subject: step.subject,
            bodyHtml: DOMPurify.sanitize(step.bodyHtml),
            delayDays: step.delayDays,
          })),
        },
      },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
      },
    })

    return reply.code(201).send({ campaign })
  })

  // GET /api/campaigns/:id
  fastify.get<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
      include: {
        steps: { orderBy: { stepNumber: 'asc' } },
        _count: { select: { emailSends: true } },
      },
    })

    if (!campaign) throw new NotFoundError('campaign_not_found')

    return { campaign }
  })

  // PATCH /api/campaigns/:id
  fastify.patch<{ Params: { id: string } }>('/:id', async (request, _reply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    })

    if (!campaign) throw new NotFoundError('campaign_not_found')

    const body = updateCampaignSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    // If changing fromAccountId, verify ownership
    if (body.data.fromAccountId) {
      const account = await fastify.prisma.emailAccount.findFirst({
        where: { id: body.data.fromAccountId, userId: request.user.id },
      })
      if (!account) throw new NotFoundError('account_not_found')
    }

    const updated = await fastify.prisma.campaign.update({
      where: { id: campaign.id },
      data: body.data,
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    })

    return { campaign: updated }
  })

  // DELETE /api/campaigns/:id
  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const campaign = await fastify.prisma.campaign.findFirst({
      where: {
        id: request.params.id,
        userId: request.user.id,
      },
    })

    if (!campaign) throw new NotFoundError('campaign_not_found')

    if (campaign.status !== 'draft') {
      throw new BadRequestError(
        'campaign_not_draft',
        'Only draft campaigns can be deleted. Pause the campaign first.',
      )
    }

    await fastify.prisma.campaign.delete({ where: { id: campaign.id } })

    return reply.code(204).send()
  })

  // POST /api/campaigns/:id/start
  fastify.post<{ Params: { id: string } }>(
    '/:id/start',
    async (request, _reply) => {
      const campaign = await fastify.prisma.campaign.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
      })

      if (!campaign) throw new NotFoundError('campaign_not_found')

      if (!['draft', 'paused'].includes(campaign.status)) {
        throw new BadRequestError(
          'invalid_status',
          `Campaign cannot be started from status '${campaign.status}'`,
        )
      }

      if (!campaign.fromAccountId) {
        throw new BadRequestError(
          'missing_account',
          'Campaign requires a sending account before it can be started',
        )
      }

      if (campaign.steps.length === 0) {
        throw new BadRequestError(
          'no_steps',
          'Campaign requires at least one step before starting',
        )
      }

      const updated = await fastify.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'running' },
      })

      return { campaign: updated }
    },
  )

  // POST /api/campaigns/:id/pause
  fastify.post<{ Params: { id: string } }>(
    '/:id/pause',
    async (request, _reply) => {
      const campaign = await fastify.prisma.campaign.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
      })

      if (!campaign) throw new NotFoundError('campaign_not_found')

      if (campaign.status !== 'running') {
        throw new BadRequestError(
          'invalid_status',
          `Campaign is not running (status: ${campaign.status})`,
        )
      }

      const updated = await fastify.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'paused' },
      })

      return { campaign: updated }
    },
  )

  // POST /api/campaigns/:id/resume
  fastify.post<{ Params: { id: string } }>(
    '/:id/resume',
    async (request, _reply) => {
      const campaign = await fastify.prisma.campaign.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
      })

      if (!campaign) throw new NotFoundError('campaign_not_found')

      if (campaign.status !== 'paused') {
        throw new BadRequestError(
          'invalid_status',
          `Campaign is not paused (status: ${campaign.status})`,
        )
      }

      const updated = await fastify.prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'running' },
      })

      return { campaign: updated }
    },
  )

  // POST /api/campaigns/:id/contacts/import
  fastify.post<{ Params: { id: string } }>(
    '/:id/contacts/import',
    async (request, reply) => {
      const campaign = await fastify.prisma.campaign.findFirst({
        where: {
          id: request.params.id,
          userId: request.user.id,
        },
      })

      if (!campaign) throw new NotFoundError('campaign_not_found')

      // Parse multipart CSV
      let csvContent = ''
      try {
        const data = await (request as unknown as {
          file(): Promise<{
            mimetype: string
            toBuffer(): Promise<Buffer>
          } | null>
        }).file()

        if (!data) throw new BadRequestError('missing_file', 'CSV file is required')

        if (
          !data.mimetype.includes('csv') &&
          !data.mimetype.includes('text/plain')
        ) {
          throw new BadRequestError('invalid_file_type', 'Only CSV files are allowed')
        }

        const buffer = await data.toBuffer()
        if (buffer.length > 10 * 1024 * 1024) {
          throw new BadRequestError('file_too_large', 'CSV file must be under 10MB')
        }
        csvContent = buffer.toString('utf-8')
      } catch (err) {
        if (err instanceof BadRequestError) throw err
        throw new BadRequestError('file_parse_error', 'Failed to parse uploaded file')
      }

      const lines = csvContent.split('\n').map((l) => l.trim()).filter(Boolean)
      if (lines.length < 2) {
        throw new BadRequestError('empty_csv', 'CSV must have a header row and at least one data row')
      }

      const headers = (lines[0] ?? '').toLowerCase().split(',').map((h) => h.trim())
      const emailIdx = headers.indexOf('email')
      if (emailIdx === -1) {
        throw new BadRequestError('missing_email_column', 'CSV must have an "email" column')
      }

      const firstNameIdx = headers.indexOf('first_name')
      const lastNameIdx = headers.indexOf('last_name')
      const companyIdx = headers.indexOf('company')
      const positionIdx = headers.indexOf('position')

      const contacts: Array<{
        userId: string
        email: string
        firstName?: string
        lastName?: string
        company?: string
        position?: string
      }> = []

      for (let i = 1; i < lines.length; i++) {
        const cols = (lines[i] ?? '').split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const email = cols[emailIdx]?.toLowerCase()
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue

        contacts.push({
          userId: campaign.userId,
          email,
          firstName: firstNameIdx >= 0 ? (cols[firstNameIdx] ?? undefined) : undefined,
          lastName: lastNameIdx >= 0 ? (cols[lastNameIdx] ?? undefined) : undefined,
          company: companyIdx >= 0 ? (cols[companyIdx] ?? undefined) : undefined,
          position: positionIdx >= 0 ? (cols[positionIdx] ?? undefined) : undefined,
        })
      }

      if (contacts.length === 0) {
        throw new BadRequestError('no_valid_contacts', 'No valid email addresses found in CSV')
      }

      // Bulk upsert (skip duplicates)
      await fastify.prisma.$transaction(
        contacts.map((contact) =>
          fastify.prisma.contact.upsert({
            where: {
              userId_email: {
                userId: campaign.userId,
                email: contact.email,
              },
            },
            create: contact,
            update: {
              firstName: contact.firstName ?? undefined,
              lastName: contact.lastName ?? undefined,
              company: contact.company ?? undefined,
              position: contact.position ?? undefined,
            },
          }),
        ),
      )

      return reply.code(201).send({
        imported: contacts.length,
        message: `${contacts.length} contacts imported successfully`,
      })
    },
  )
}

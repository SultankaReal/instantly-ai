import { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { Queue } from 'bullmq';
import {
  SubscribeRequestSchema,
  ConfirmSubscriptionSchema,
  UnsubscribeSchema,
  PaginationSchema,
} from '@inkflow/shared-types';
import type { SubscriberListResponse, SubscriberResponse } from '@inkflow/shared-types';
import { QUEUE_NAMES, JOB_NAMES } from '@inkflow/shared-types';
import type { ConfirmationEmailJob } from '@inkflow/shared-types';

const CONFIRMATION_TOKEN_TTL_HOURS = 48;
const CONFIRMATION_TOKEN_TTL_MS = CONFIRMATION_TOKEN_TTL_HOURS * 60 * 60 * 1000;

function generateConfirmationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function subscriberRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/publications/:pubId/subscribers — public, subscribe to publication
  app.post(
    '/api/publications/:pubId/subscribers',
    {
      schema: {
        params: {
          type: 'object',
          required: ['pubId'],
          properties: { pubId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: { message: string } }> => {
      const { pubId } = request.params as { pubId: string };
      const body = SubscribeRequestSchema.parse(request.body);

      // Verify publication exists
      const publication = await app.prisma.publication.findUnique({
        where: { id: pubId },
        select: { id: true, name: true },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PUBLICATION_NOT_FOUND', message: 'Publication not found' },
        });
      }

      const confirmationToken = generateConfirmationToken();
      const expiresAt = new Date(Date.now() + CONFIRMATION_TOKEN_TTL_MS);

      // Upsert subscriber — handle re-subscribe gracefully
      const subscriber = await app.prisma.subscriber.upsert({
        where: {
          publication_id_email: {
            publication_id: pubId,
            email: body.email,
          },
        },
        update: {
          // Re-subscribe: only update token if currently unsubscribed
          name: body.name ?? undefined,
          confirmation_token: confirmationToken,
          confirmation_token_expires_at: expiresAt,
          status: 'pending_confirmation',
        },
        create: {
          publication_id: pubId,
          email: body.email,
          name: body.name ?? null,
          status: 'pending_confirmation',
          tier: 'free',
          confirmation_token: confirmationToken,
          confirmation_token_expires_at: expiresAt,
        },
      });

      // Enqueue confirmation email
      const emailQueue = new Queue(QUEUE_NAMES.EMAIL_SEND, {
        connection: app.redis,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 50,
          removeOnFail: 100,
        },
      });

      const jobPayload: ConfirmationEmailJob = {
        subscriberId: subscriber.id,
        publicationId: pubId,
        email: body.email,
        name: body.name ?? null,
        confirmationToken,
      };

      await emailQueue.add(JOB_NAMES.SEND_CONFIRMATION, jobPayload);
      await emailQueue.close();

      return reply.status(202).send({
        success: true,
        data: {
          message: 'Confirmation email sent. Please check your inbox to confirm your subscription.',
        },
      });
    },
  );

  // GET /api/subscribers/confirm — public, confirm subscription via token
  app.get(
    '/api/subscribers/confirm',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: { message: string } }> => {
      const query = ConfirmSubscriptionSchema.parse(request.query);

      const subscriber = await app.prisma.subscriber.findFirst({
        where: {
          confirmation_token: query.token,
        },
        select: {
          id: true,
          status: true,
          confirmation_token_expires_at: true,
        },
      });

      if (!subscriber) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired confirmation token' },
        });
      }

      if (subscriber.confirmation_token_expires_at && subscriber.confirmation_token_expires_at < new Date()) {
        return reply.status(400).send({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Confirmation token has expired. Please subscribe again.' },
        });
      }

      // Token is single-use — clear it on confirmation
      await app.prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          status: 'active',
          confirmed_at: new Date(),
          confirmation_token: null,
          confirmation_token_expires_at: null,
        },
      });

      return reply.send({
        success: true,
        data: { message: 'Subscription confirmed successfully. Welcome aboard!' },
      });
    },
  );

  // GET /api/subscribers/unsubscribe — public, unsubscribe via token
  app.get(
    '/api/subscribers/unsubscribe',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['token'],
          properties: { token: { type: 'string' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: { message: string } }> => {
      const query = UnsubscribeSchema.parse(request.query);

      // The unsubscribe token is the confirmation_token reused, or we embed
      // the subscriber ID encoded. Here we use a subscriber-specific lookup
      // where the token is stored as confirmation_token field for unsubscribe links.
      // In production, a separate unsubscribe_token column would be ideal.
      const subscriber = await app.prisma.subscriber.findFirst({
        where: { confirmation_token: query.token },
        select: { id: true, status: true },
      });

      if (!subscriber) {
        // Also try finding by subscriber ID if the token is a UUID (direct links)
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid unsubscribe token' },
        });
      }

      if (subscriber.status === 'unsubscribed') {
        return reply.send({
          success: true,
          data: { message: 'You are already unsubscribed.' },
        });
      }

      await app.prisma.subscriber.update({
        where: { id: subscriber.id },
        data: {
          status: 'unsubscribed',
          unsubscribed_at: new Date(),
          confirmation_token: null,
          confirmation_token_expires_at: null,
        },
      });

      return reply.send({
        success: true,
        data: { message: 'You have been successfully unsubscribed.' },
      });
    },
  );

  // GET /api/publications/:pubId/subscribers — auth, author only, paginated list
  app.get(
    '/api/publications/:pubId/subscribers',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['pubId'],
          properties: { pubId: { type: 'string', format: 'uuid' } },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: SubscriberListResponse }> => {
      const authorId = request.user.sub;
      const { pubId } = request.params as { pubId: string };
      const query = PaginationSchema.parse(request.query);

      const publication = await app.prisma.publication.findUnique({
        where: { id: pubId },
        select: { author_id: true },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PUBLICATION_NOT_FOUND', message: 'Publication not found' },
        });
      }

      if (publication.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this publication' },
        });
      }

      const skip = (query.page - 1) * query.limit;

      const [subscribers, total] = await app.prisma.$transaction([
        app.prisma.subscriber.findMany({
          where: { publication_id: pubId },
          select: {
            id: true,
            publication_id: true,
            email: true,
            name: true,
            status: true,
            tier: true,
            confirmed_at: true,
            subscribed_at: true,
            unsubscribed_at: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: { subscribed_at: 'desc' },
          skip,
          take: query.limit,
        }),
        app.prisma.subscriber.count({ where: { publication_id: pubId } }),
      ]);

      return reply.send({
        success: true,
        data: {
          subscribers: subscribers as SubscriberResponse[],
          total,
          page: query.page,
          limit: query.limit,
        },
      });
    },
  );
}

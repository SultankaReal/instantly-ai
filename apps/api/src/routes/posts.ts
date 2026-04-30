import { FastifyInstance } from 'fastify';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';
import { Queue } from 'bullmq';
import {
  CreatePostSchema,
  UpdatePostSchema,
  PaginationSchema,
} from '@inkflow/shared-types';
import type {
  PostResponse,
  TruncatedPostResponse,
  PostListResponse,
  PostAnalyticsResponse,
} from '@inkflow/shared-types';
import { QUEUE_NAMES, JOB_NAMES } from '@inkflow/shared-types';
import type { EmailBatch, EmailRecipient } from '@inkflow/shared-types';

function sanitizeHtml(html: string): string {
  const window = new JSDOM('').window;
  // DOMPurify requires a window-like environment
  const purify = DOMPurify(window as unknown as Window & typeof globalThis);
  return purify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'strong', 'em', 'u', 's', 'del',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'a', 'img', 'figure', 'figcaption',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'hr', 'div', 'span',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100);
}

function truncateHtmlTo20Percent(html: string): string {
  // Simple character-based truncation — preserves the HTML structure approximately
  const cutoff = Math.ceil(html.length * 0.2);
  return html.slice(0, cutoff);
}

export async function postRoutes(app: FastifyInstance): Promise<void> {
  // Shared queue instance — created once, not per-request, to avoid connection leaks
  const BATCH_SIZE = 500; // Postmark batch API allows max 500 messages per call

  const emailQueue = new Queue(QUEUE_NAMES.EMAIL_SEND, {
    connection: app.redis,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  // GET /api/publications/:pubId/posts — auth required, paginated list
  app.get(
    '/api/publications/:pubId/posts',
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
    async (request, reply): Promise<{ success: true; data: PostListResponse }> => {
      const authorId = request.user.sub;
      const { pubId } = request.params as { pubId: string };
      const query = PaginationSchema.parse(request.query);

      // Verify publication ownership
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

      const [posts, total] = await app.prisma.$transaction([
        app.prisma.post.findMany({
          where: { publication_id: pubId },
          select: {
            id: true,
            title: true,
            subtitle: true,
            slug: true,
            status: true,
            access: true,
            published_at: true,
            scheduled_at: true,
            created_at: true,
          },
          orderBy: { created_at: 'desc' },
          skip,
          take: query.limit,
        }),
        app.prisma.post.count({ where: { publication_id: pubId } }),
      ]);

      return reply.send({
        success: true,
        data: { posts, total, page: query.page, limit: query.limit },
      });
    },
  );

  // POST /api/publications/:pubId/posts — auth required
  app.post(
    '/api/publications/:pubId/posts',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['pubId'],
          properties: { pubId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PostResponse }> => {
      const authorId = request.user.sub;
      const { pubId } = request.params as { pubId: string };
      const body = CreatePostSchema.parse(request.body);

      const publication = await app.prisma.publication.findUnique({
        where: { id: pubId },
        select: { id: true, author_id: true, name: true, slug: true },
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

      // Sanitize HTML content before storage
      const sanitizedHtml = sanitizeHtml(body.content_html);

      // Generate unique slug from title
      const baseSlug = generateSlugFromTitle(body.title);
      let slug = baseSlug;
      let attempt = 0;

      while (true) {
        const existing = await app.prisma.post.findUnique({
          where: { publication_id_slug: { publication_id: pubId, slug } },
          select: { id: true },
        });
        if (!existing) break;
        attempt++;
        slug = `${baseSlug}-${attempt}`;
      }

      const post = await app.prisma.post.create({
        data: {
          publication_id: pubId,
          author_id: authorId,
          title: body.title,
          subtitle: body.subtitle ?? null,
          content_html: sanitizedHtml,
          slug,
          access: body.access,
          meta_description: body.meta_description ?? null,
          scheduled_at: body.scheduled_at ?? null,
          status: body.scheduled_at ? 'scheduled' : 'draft',
        },
        include: {
          publication: { select: { id: true, name: true, slug: true } },
        },
      });

      return reply.status(201).send({
        success: true,
        data: post,
      });
    },
  );

  // GET /api/posts/:id — optional auth, paywall enforced server-side
  app.get(
    '/api/posts/:id',
    {
      preHandler: [app.optionalAuthenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PostResponse | TruncatedPostResponse }> => {
      const userId: string | null = request.user?.sub ?? null;
      const { id } = request.params as { id: string };

      const post = await app.prisma.post.findUnique({
        where: { id },
        include: {
          publication: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        });
      }

      // Only published/sent posts are publicly accessible
      if (post.status !== 'published' && post.status !== 'sent') {
        // Allow the author to preview their own drafts
        if (!userId || userId !== post.author_id) {
          return reply.status(404).send({
            success: false,
            error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
          });
        }
      }

      // Paywall: paid posts require an active paid subscriber
      if (post.access === 'paid') {
        let hasAccess = false;

        if (userId) {
          // Check if the authenticated user is the author
          if (userId === post.author_id) {
            hasAccess = true;
          } else {
            // Check subscriber tier via email — the user's JWT has their email
            const subscriber = await app.prisma.subscriber.findFirst({
              where: {
                publication_id: post.publication_id,
                email: request.user?.email ?? '',
                status: 'active',
                tier: { in: ['paid', 'trial'] },
              },
              select: { id: true },
            });
            hasAccess = !!subscriber;
          }
        }

        if (!hasAccess) {
          const truncatedHtml = truncateHtmlTo20Percent(post.content_html);
          const upgradeUrl = `/publications/${post.publication.slug}/subscribe`;

          return reply.send({
            success: true,
            data: {
              ...post,
              content_html: truncatedHtml,
              truncated: true,
              upgrade_url: upgradeUrl,
            } as TruncatedPostResponse,
          });
        }
      }

      return reply.send({
        success: true,
        data: post,
      });
    },
  );

  // GET /api/publications/:pubId/posts/:postSlug — public, no auth, paywall enforced
  app.get(
    '/api/publications/:pubId/posts/:postSlug',
    {
      preHandler: [app.optionalAuthenticate],
      schema: {
        params: {
          type: 'object',
          required: ['pubId', 'postSlug'],
          properties: {
            pubId: { type: 'string', format: 'uuid' },
            postSlug: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const userId: string | null = request.user?.sub ?? null;
      const { pubId, postSlug } = request.params as { pubId: string; postSlug: string };

      const post = await app.prisma.post.findUnique({
        where: { publication_id_slug: { publication_id: pubId, slug: postSlug } },
        include: {
          publication: { select: { id: true, name: true, slug: true } },
        },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        });
      }

      // Only published/sent posts are publicly accessible
      if (post.status !== 'published' && post.status !== 'sent') {
        if (!userId || userId !== post.author_id) {
          return reply.status(404).send({
            success: false,
            error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
          });
        }
      }

      // Paywall: paid posts require active paid subscriber
      if (post.access === 'paid') {
        let hasAccess = false;
        if (userId) {
          if (userId === post.author_id) {
            hasAccess = true;
          } else {
            const subscriber = await app.prisma.subscriber.findFirst({
              where: {
                publication_id: post.publication_id,
                email: request.user?.email ?? '',
                status: 'active',
                tier: { in: ['paid', 'trial'] },
              },
              select: { id: true },
            });
            hasAccess = !!subscriber;
          }
        }
        if (!hasAccess) {
          const truncatedHtml = truncateHtmlTo20Percent(post.content_html);
          const upgradeUrl = `/${post.publication.slug}/subscribe`;
          return reply.send({
            success: true,
            data: {
              ...post,
              content_html: truncatedHtml,
              truncated: true,
              upgrade_url: upgradeUrl,
            },
          });
        }
      }

      return reply.send({ success: true, data: post });
    },
  );

  // PATCH /api/posts/:id — auth required, ownership verified
  app.patch(
    '/api/posts/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PostResponse }> => {
      const authorId = request.user.sub;
      const { id } = request.params as { id: string };
      const body = UpdatePostSchema.parse(request.body);

      const post = await app.prisma.post.findUnique({
        where: { id },
        select: { id: true, author_id: true, publication_id: true, slug: true },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        });
      }

      if (post.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this post' },
        });
      }

      // Sanitize HTML if content is being updated
      let sanitizedHtml: string | undefined;
      if (body.content_html !== undefined) {
        sanitizedHtml = sanitizeHtml(body.content_html);
      }

      const updated = await app.prisma.post.update({
        where: { id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
          ...(sanitizedHtml !== undefined && { content_html: sanitizedHtml }),
          ...(body.access !== undefined && { access: body.access }),
          ...(body.meta_description !== undefined && { meta_description: body.meta_description }),
          ...(body.scheduled_at !== undefined && {
            scheduled_at: body.scheduled_at,
            status: 'scheduled',
          }),
          ...(body.status === 'published' && {
            status: 'published',
            published_at: new Date(),
          }),
        },
        include: {
          publication: { select: { id: true, name: true, slug: true } },
        },
      });

      return reply.send({
        success: true,
        data: updated,
      });
    },
  );

  // DELETE /api/posts/:id — auth required, only drafts can be deleted
  app.delete(
    '/api/posts/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true }> => {
      const authorId = request.user.sub;
      const { id } = request.params as { id: string };

      const post = await app.prisma.post.findUnique({
        where: { id },
        select: { id: true, author_id: true, status: true },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        });
      }

      if (post.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this post' },
        });
      }

      if (post.status !== 'draft') {
        return reply.status(409).send({
          success: false,
          error: { code: 'CANNOT_DELETE_SENT_POST', message: 'Only draft posts can be deleted' },
        });
      }

      await app.prisma.post.delete({ where: { id } });

      return reply.status(200).send({ success: true });
    },
  );

  // POST /api/posts/:id/send — auth required, enqueue email send
  app.post(
    '/api/posts/:id/send',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: { message: string; jobsQueued: number } }> => {
      const authorId = request.user.sub;
      const { id: postId } = request.params as { id: string };

      // Verify post exists and author owns it
      const post = await app.prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, author_id: true, publication_id: true, status: true, published_at: true },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        });
      }

      if (post.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this post' },
        });
      }

      if (post.status === 'sent') {
        return reply.status(409).send({
          success: false,
          error: { code: 'POST_ALREADY_SENT', message: 'This post has already been sent' },
        });
      }

      // Fetch all active subscribers for the publication
      const subscribers = await app.prisma.subscriber.findMany({
        where: {
          publication_id: post.publication_id,
          status: 'active',
        },
        select: { id: true, email: true, name: true },
      });

      if (subscribers.length === 0) {
        // Mark as sent anyway (no-op), set published_at if not already set
        await app.prisma.post.update({
          where: { id: postId },
          data: {
            status: 'sent',
            sent_at: new Date(),
            published_at: post.published_at ?? new Date(),
          },
        });

        return reply.send({
          success: true,
          data: { message: 'Post sent (0 active subscribers)', jobsQueued: 0 },
        });
      }

      // Create EmailSend records for each subscriber
      const emailSendData = subscribers.map((s) => ({
        post_id: postId,
        subscriber_id: s.id,
        status: 'queued' as const,
        queued_at: new Date(),
      }));

      await app.prisma.emailSend.createMany({
        data: emailSendData,
        skipDuplicates: true,
      });

      // Split subscribers into batches of BATCH_SIZE and enqueue BullMQ jobs
      const batches: EmailRecipient[][] = [];
      for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
        batches.push(subscribers.slice(i, i + BATCH_SIZE));
      }

      const totalBatches = batches.length;
      for (let batchNumber = 1; batchNumber <= totalBatches; batchNumber++) {
        const batchSubscribers = batches[batchNumber - 1];
        if (!batchSubscribers) continue;

        const payload: EmailBatch = {
          postId,
          publicationId: post.publication_id,
          recipients: batchSubscribers.map((s) => ({
            id: s.id,
            email: s.email,
            name: s.name,
          })),
          batchNumber,
          totalBatches,
        };

        await emailQueue.add(JOB_NAMES.SEND_EMAIL_BATCH, payload);
      }

      // Update post status to 'sent', set published_at if not already set
      await app.prisma.post.update({
        where: { id: postId },
        data: {
          status: 'sent',
          sent_at: new Date(),
          published_at: post.published_at ?? new Date(),
        },
      });

      return reply.send({
        success: true,
        data: {
          message: `Post queued for delivery to ${subscribers.length} subscribers`,
          jobsQueued: totalBatches,
        },
      });
    },
  );

  // GET /api/posts/:id/analytics — auth required
  app.get(
    '/api/posts/:id/analytics',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PostAnalyticsResponse }> => {
      const authorId = request.user.sub;
      const { id: postId } = request.params as { id: string };

      const post = await app.prisma.post.findUnique({
        where: { id: postId },
        select: { id: true, author_id: true },
      });

      if (!post) {
        return reply.status(404).send({
          success: false,
          error: { code: 'POST_NOT_FOUND', message: 'Post not found' },
        });
      }

      if (post.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this post' },
        });
      }

      // Aggregate EmailSend counts
      const sendStats = await app.prisma.emailSend.groupBy({
        by: ['status'],
        where: { post_id: postId },
        _count: { id: true },
      });

      const countByStatus = Object.fromEntries(
        sendStats.map((s) => [s.status, s._count.id]),
      ) as Record<string, number>;

      const totalRecipients = Object.values(countByStatus).reduce((a, b) => a + b, 0);
      const delivered = countByStatus['delivered'] ?? 0;
      const bounced = countByStatus['bounced'] ?? 0;
      const failed = countByStatus['failed'] ?? 0;

      // Aggregate EmailEvent counts via email_sends
      const emailSendIds = await app.prisma.emailSend.findMany({
        where: { post_id: postId },
        select: { id: true },
      });
      const sendIdList = emailSendIds.map((e) => e.id);

      const [openEvents, clickEvents] = await Promise.all([
        app.prisma.emailEvent.count({
          where: { email_send_id: { in: sendIdList }, event_type: 'open' },
        }),
        app.prisma.emailEvent.count({
          where: { email_send_id: { in: sendIdList }, event_type: 'click' },
        }),
      ]);

      // Unique opens/clicks — count distinct email_send_ids with the event
      const [uniqueOpenSends, uniqueClickSends] = await Promise.all([
        app.prisma.emailEvent.groupBy({
          by: ['email_send_id'],
          where: { email_send_id: { in: sendIdList }, event_type: 'open' },
        }),
        app.prisma.emailEvent.groupBy({
          by: ['email_send_id'],
          where: { email_send_id: { in: sendIdList }, event_type: 'click' },
        }),
      ]);

      const uniqueOpens = uniqueOpenSends.length;
      const uniqueClicks = uniqueClickSends.length;

      const openRate = delivered > 0 ? Math.round((uniqueOpens / delivered) * 10000) / 100 : 0;
      const clickRate = delivered > 0 ? Math.round((uniqueClicks / delivered) * 10000) / 100 : 0;

      return reply.send({
        success: true,
        data: {
          postId,
          totalRecipients,
          delivered,
          bounced,
          failed,
          opens: openEvents,
          uniqueOpens,
          clicks: clickEvents,
          uniqueClicks,
          openRate,
          clickRate,
          timeSeries: [], // Aggregated time-series can be added as a follow-up
        },
      });
    },
  );
}

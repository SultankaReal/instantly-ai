import { FastifyInstance } from 'fastify';
import { CreatePublicationSchema, UpdatePublicationSchema } from '@inkflow/shared-types';
import type { PublicationResponse } from '@inkflow/shared-types';

export async function publicationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/publications/:slug — public endpoint
  app.get(
    '/api/publications/:slug',
    {
      schema: {
        params: {
          type: 'object',
          required: ['slug'],
          properties: {
            slug: { type: 'string' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PublicationResponse & { subscriberCount: number } }> => {
      const { slug } = request.params as { slug: string };

      const publication = await app.prisma.publication.findUnique({
        where: { slug },
        include: {
          _count: {
            select: { subscribers: { where: { status: 'active' } } },
          },
        },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PUBLICATION_NOT_FOUND',
            message: 'Publication not found',
          },
        });
      }

      const { stripe_account_id: _omit, _count, ...pub } = publication;

      return reply.send({
        success: true,
        data: {
          ...pub,
          subscriberCount: _count.subscribers,
        },
      });
    },
  );

  // POST /api/publications — auth required
  app.post(
    '/api/publications',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name', 'slug'],
          properties: {
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            pricing_monthly: { type: 'integer' },
            pricing_annual: { type: 'integer' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PublicationResponse }> => {
      const authorId = request.user.sub;
      const body = CreatePublicationSchema.parse(request.body);

      // Check slug uniqueness
      const existing = await app.prisma.publication.findUnique({
        where: { slug: body.slug },
        select: { id: true },
      });

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'SLUG_ALREADY_EXISTS',
            message: 'A publication with this slug already exists',
          },
        });
      }

      const publication = await app.prisma.publication.create({
        data: {
          author_id: authorId,
          name: body.name,
          slug: body.slug,
          description: body.description ?? null,
          pricing_monthly: body.pricing_monthly ?? null,
          pricing_annual: body.pricing_annual ?? null,
        },
      });

      const { stripe_account_id: _omit, ...pub } = publication;

      return reply.status(201).send({
        success: true,
        data: pub,
      });
    },
  );

  // GET /api/publications/id/:id — auth required, return own publication
  app.get(
    '/api/publications/id/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PublicationResponse & { subscriberCount: number } }> => {
      const authorId = request.user.sub;
      const { id } = request.params as { id: string };

      const publication = await app.prisma.publication.findUnique({
        where: { id },
        include: {
          _count: {
            select: { subscribers: { where: { status: 'active' } } },
          },
        },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PUBLICATION_NOT_FOUND',
            message: 'Publication not found',
          },
        });
      }

      if (publication.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this publication',
          },
        });
      }

      const { stripe_account_id: _omit, _count, ...pub } = publication;

      return reply.send({
        success: true,
        data: {
          ...pub,
          subscriberCount: _count.subscribers,
        },
      });
    },
  );

  // PATCH /api/publications/:id — auth required, verify ownership
  app.patch(
    '/api/publications/:id',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: PublicationResponse }> => {
      const authorId = request.user.sub;
      const { id } = request.params as { id: string };
      const body = UpdatePublicationSchema.parse(request.body);

      const publication = await app.prisma.publication.findUnique({
        where: { id },
        select: { id: true, author_id: true },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: {
            code: 'PUBLICATION_NOT_FOUND',
            message: 'Publication not found',
          },
        });
      }

      if (publication.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'You do not own this publication',
          },
        });
      }

      // Check slug uniqueness if being changed
      if (body.slug) {
        const existing = await app.prisma.publication.findFirst({
          where: { slug: body.slug, id: { not: id } },
          select: { id: true },
        });

        if (existing) {
          return reply.status(409).send({
            success: false,
            error: {
              code: 'SLUG_ALREADY_EXISTS',
              message: 'A publication with this slug already exists',
            },
          });
        }
      }

      const updated = await app.prisma.publication.update({
        where: { id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...(body.slug !== undefined && { slug: body.slug }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.custom_domain !== undefined && { custom_domain: body.custom_domain }),
          ...(body.pricing_monthly !== undefined && { pricing_monthly: body.pricing_monthly }),
          ...(body.pricing_annual !== undefined && { pricing_annual: body.pricing_annual }),
        },
      });

      const { stripe_account_id: _omit, ...pub } = updated;

      return reply.send({
        success: true,
        data: pub,
      });
    },
  );
}

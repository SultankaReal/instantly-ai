import Fastify, { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import multipart from '@fastify/multipart';

import { corsPlugin } from './plugins/cors';
import { dbPlugin } from './plugins/db';
import { redisPlugin } from './plugins/redis';
import { authPlugin } from './plugins/auth';

import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { publicationRoutes } from './routes/publications';
import { postRoutes } from './routes/posts';
import { subscriberRoutes } from './routes/subscribers';
import { paymentRoutes } from './routes/payments';
import { webhookRoutes } from './routes/webhooks';
import { aiRoutes } from './routes/ai';
import { importRoutes } from './routes/import';

export async function buildApp(): Promise<FastifyInstance> {
  const isDev = process.env['NODE_ENV'] !== 'production';

  const app = Fastify({
    logger: isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          },
        }
      : true,
    trustProxy: true,
    // Raw body is needed for Stripe webhook signature verification
    // We register a custom content-type parser in the webhooks route
  });

  // ── Infrastructure plugins ────────────────────────────────────────────────
  await app.register(corsPlugin);
  await app.register(dbPlugin);
  await app.register(redisPlugin);
  await app.register(authPlugin);

  await app.register(multipart, {
    limits: {
      fileSize: 50 * 1024 * 1024, // 50 MB
      files: 1,
      fields: 5,
    },
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(publicationRoutes);
  await app.register(postRoutes);
  await app.register(subscriberRoutes);
  await app.register(paymentRoutes);
  await app.register(webhookRoutes);
  await app.register(aiRoutes);
  await app.register(importRoutes);

  // ── Global error handler ──────────────────────────────────────────────────
  app.setErrorHandler((error, request, reply) => {
    const requestId = request.id;

    // Zod validation errors
    if (error instanceof ZodError) {
      const details: Record<string, string[]> = {};
      for (const issue of error.errors) {
        const field = issue.path.join('.') || '_root';
        if (!details[field]) {
          details[field] = [];
        }
        details[field]!.push(issue.message);
      }
      return reply.status(422).send({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details,
        },
      });
    }

    // Known application errors with statusCode
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({
        success: false,
        error: {
          code: error.code ?? 'REQUEST_ERROR',
          message: error.message,
        },
      });
    }

    // Unexpected server errors — never leak internals
    app.log.error({ err: error, requestId }, 'Unhandled error');
    return reply.status(500).send({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });

  return app;
}

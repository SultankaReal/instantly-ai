import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import dbPlugin from './plugins/db.js'
import redisPlugin from './plugins/redis.js'
import authPlugin from './plugins/auth.js'
import { AppError } from './lib/errors.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { accountsRoutes } from './routes/accounts.js'
import { campaignsRoutes } from './routes/campaigns.js'
import { inboxRoutes } from './routes/inbox.js'
import { billingRoutes } from './routes/billing.js'
import { unsubscribeRoutes } from './routes/unsubscribe.js'

export async function buildApp(): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger:
      process.env['NODE_ENV'] === 'production'
        ? { level: 'info' }
        : { level: 'debug', transport: { target: 'pino-pretty' } },
    // Raw body needed for webhook signature verification
    // Fastify 5 uses onSend hooks for raw body capture
  })

  // ---------------------------------------------------------------------------
  // Plugins
  // ---------------------------------------------------------------------------

  await app.register(cors, {
    origin: process.env['APP_URL'] ?? 'http://localhost:3001',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis: undefined, // uses in-memory by default; set to fastify.redis after registration
  })

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  })

  // Infrastructure plugins (db, redis, auth)
  await app.register(dbPlugin)
  await app.register(redisPlugin)
  await app.register(authPlugin)

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  await app.register(healthRoutes)
  await app.register(unsubscribeRoutes)
  await app.register(authRoutes, { prefix: '/api/auth' })
  await app.register(accountsRoutes, { prefix: '/api/accounts' })
  await app.register(campaignsRoutes, { prefix: '/api/campaigns' })
  await app.register(inboxRoutes, { prefix: '/api/inbox' })
  await app.register(billingRoutes, { prefix: '/api/billing' })

  // ---------------------------------------------------------------------------
  // Global error handler
  // ---------------------------------------------------------------------------

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: error.code,
        message: error.message,
      })
    }

    // Fastify validation errors
    if (error.statusCode === 400 && 'validation' in error) {
      return reply.code(400).send({
        error: 'validation_error',
        message: error.message,
      })
    }

    // Rate limit errors
    if (error.statusCode === 429) {
      return reply.code(429).send({
        error: 'too_many_requests',
        message: 'Rate limit exceeded',
      })
    }

    app.log.error({ err: error, url: request.url }, 'Unhandled error')

    return reply.code(500).send({ error: 'internal_error' })
  })

  // 404 handler
  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: 'not_found', message: 'Route not found' })
  })

  return app
}

import fp from 'fastify-plugin'
import { type Redis as RedisType, Redis } from 'ioredis'
import type { FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisType
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redis = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  })

  redis.on('error', (err: Error) => {
    fastify.log.error({ err }, 'Redis error')
  })

  await redis.ping()

  fastify.decorate('redis', redis)

  fastify.addHook('onClose', async () => {
    await redis.quit()
  })
}

export default fp(redisPlugin, { name: 'redis' })

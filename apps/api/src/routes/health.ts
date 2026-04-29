import type { FastifyPluginAsync } from 'fastify'

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, _reply) => {
    await fastify.prisma.$queryRaw`SELECT 1`
    await fastify.redis.ping()
    return {
      status: 'ok',
      db: 'ok',
      redis: 'ok',
      timestamp: new Date().toISOString(),
    }
  })
}

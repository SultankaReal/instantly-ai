import { FastifyInstance } from 'fastify';

type HealthResponse = {
  status: 'ok' | 'degraded';
  db: 'ok' | 'error';
  redis: 'ok' | 'error';
  timestamp: string;
};

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/health',
    {
      schema: {
        description: 'Health check — verifies DB and Redis connectivity',
        tags: ['health'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              db: { type: 'string' },
              redis: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply): Promise<HealthResponse> => {
      let dbStatus: 'ok' | 'error' = 'ok';
      let redisStatus: 'ok' | 'error' = 'ok';

      // Check PostgreSQL — run a lightweight query
      try {
        await app.prisma.$queryRaw`SELECT 1`;
      } catch (err) {
        app.log.error({ err }, 'Health check: DB unreachable');
        dbStatus = 'error';
      }

      // Check Redis — PING command
      try {
        const pong = await app.redis.ping();
        if (pong !== 'PONG') {
          redisStatus = 'error';
        }
      } catch (err) {
        app.log.error({ err }, 'Health check: Redis unreachable');
        redisStatus = 'error';
      }

      const allOk = dbStatus === 'ok' && redisStatus === 'ok';
      const statusCode = allOk ? 200 : 503;

      return reply.status(statusCode).send({
        status: allOk ? 'ok' : 'degraded',
        db: dbStatus,
        redis: redisStatus,
        timestamp: new Date().toISOString(),
      });
    },
  );
}

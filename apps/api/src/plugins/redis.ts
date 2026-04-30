import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

async function redisPlugin(app: FastifyInstance): Promise<void> {
  const redisUrl = process.env['REDIS_URL'];
  if (!redisUrl) {
    throw new Error('REDIS_URL environment variable is required');
  }

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 2000);
      return delay;
    },
    reconnectOnError(err) {
      app.log.error({ err }, 'Redis connection error — reconnecting');
      return true;
    },
  });

  redis.on('connect', () => {
    app.log.info('Redis connected');
  });

  redis.on('error', (err: Error) => {
    app.log.error({ err }, 'Redis error');
  });

  // Wait for the connection to be ready
  await new Promise<void>((resolve, reject) => {
    redis.once('ready', resolve);
    redis.once('error', reject);
  });

  app.decorate('redis', redis);

  app.addHook('onClose', async () => {
    app.log.info('Disconnecting Redis...');
    await redis.quit();
  });
}

export default fp(redisPlugin, { name: 'redis' });
export { redisPlugin };

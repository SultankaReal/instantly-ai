import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

async function dbPlugin(app: FastifyInstance): Promise<void> {
  const prisma = new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'production'
        ? ['error']
        : ['query', 'info', 'warn', 'error'],
  });

  await prisma.$connect();
  app.log.info('Prisma connected to PostgreSQL');

  app.decorate('prisma', prisma);

  app.addHook('onClose', async () => {
    app.log.info('Disconnecting Prisma...');
    await prisma.$disconnect();
  });
}

export default fp(dbPlugin, { name: 'prisma' });
export { dbPlugin };

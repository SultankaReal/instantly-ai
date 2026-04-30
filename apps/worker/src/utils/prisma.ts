import { PrismaClient } from '@prisma/client';

/**
 * Singleton PrismaClient instance for the worker process.
 * Re-using one client avoids connection pool exhaustion.
 */
const prisma = new PrismaClient({
  log:
    process.env['NODE_ENV'] === 'production'
      ? ['error']
      : ['query', 'info', 'warn', 'error'],
});

export default prisma;

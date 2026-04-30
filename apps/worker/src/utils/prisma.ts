import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log:
    process.env['NODE_ENV'] === 'production'
      ? ['error']
      : ['query', 'info', 'warn', 'error'],
});

export default prisma;

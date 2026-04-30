import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';

async function corsPlugin(app: FastifyInstance): Promise<void> {
  const appUrl = process.env['APP_URL'];
  const isDev = process.env['NODE_ENV'] !== 'production';

  let origin: string | boolean | RegExp | Array<string | RegExp>;

  if (isDev) {
    origin = true; // Allow all in dev
  } else if (appUrl) {
    origin = [
      appUrl,
      /\.inkflow\.io$/,
    ];
  } else {
    origin = /\.inkflow\.io$/;
  }

  await app.register(fastifyCors, {
    origin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400, // 24 hours preflight cache
  });
}

export default fp(corsPlugin, { name: 'cors' });
export { corsPlugin };

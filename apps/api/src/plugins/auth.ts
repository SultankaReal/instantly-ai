import fp from 'fastify-plugin';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';

type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  jti?: string;
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    optionalAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

async function authPlugin(app: FastifyInstance): Promise<void> {
  const jwtSecret = process.env['JWT_SECRET'];
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  await app.register(fastifyJwt, {
    secret: jwtSecret,
    sign: {
      algorithm: 'HS256',
    },
  });

  app.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      try {
        await request.jwtVerify();
        const payload = request.user;

        if (payload.type !== 'access') {
          return reply.status(401).send({
            success: false,
            error: {
              code: 'INVALID_TOKEN_TYPE',
              message: 'Access token required',
            },
          });
        }
      } catch {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
      }
    },
  );

  app.decorate(
    'optionalAuthenticate',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      try {
        await request.jwtVerify();
      } catch {
        // Not authenticated — request.user will be undefined
        // Callers must handle this case
      }
    },
  );
}

export default fp(authPlugin, { name: 'auth' });
export { authPlugin };
export type { JwtPayload };

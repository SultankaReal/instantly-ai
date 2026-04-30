import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { RegisterSchema, LoginSchema } from '@inkflow/shared-types';
import type { AuthResponse, RefreshTokenResponse } from '@inkflow/shared-types';
import type { JwtPayload } from '../plugins/auth';

const BCRYPT_COST = 12;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

function buildRefreshRedisKey(userId: string, tokenId: string): string {
  return `session:${userId}:refresh:${tokenId}`;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/auth/register
  app.post(
    '/api/auth/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'name', 'confirmPassword'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 1 },
            confirmPassword: { type: 'string' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: AuthResponse }> => {
      const body = RegisterSchema.parse(request.body);

      const existing = await app.prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true },
      });

      if (existing) {
        return reply.status(409).send({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email already exists',
          },
        });
      }

      const password_hash = await bcrypt.hash(body.password, BCRYPT_COST);

      const user = await app.prisma.user.create({
        data: {
          email: body.email,
          password_hash,
          name: body.name,
          role: 'author',
        },
        select: { id: true, email: true, name: true, role: true },
      });

      const tokenId = uuidv4();

      const accessToken = app.jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          type: 'access',
        } satisfies Omit<JwtPayload, 'jti'>,
        { expiresIn: ACCESS_TOKEN_TTL },
      );

      const refreshToken = app.jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          type: 'refresh',
          jti: tokenId,
        } satisfies JwtPayload,
        { expiresIn: REFRESH_TOKEN_TTL },
      );

      // Persist refresh token reference in Redis
      await app.redis.setex(
        buildRefreshRedisKey(user.id, tokenId),
        REFRESH_TOKEN_TTL_SECONDS,
        '1',
      );

      return reply.status(201).send({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user,
        },
      });
    },
  );

  // POST /api/auth/login
  app.post(
    '/api/auth/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: AuthResponse }> => {
      const body = LoginSchema.parse(request.body);

      const user = await app.prisma.user.findUnique({
        where: { email: body.email },
        select: { id: true, email: true, name: true, role: true, password_hash: true },
      });

      const INVALID_CREDS_RESPONSE = {
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      } as const;

      if (!user) {
        // Run bcrypt to prevent timing attacks
        await bcrypt.hash(body.password, BCRYPT_COST);
        return reply.status(401).send(INVALID_CREDS_RESPONSE);
      }

      const passwordValid = await bcrypt.compare(body.password, user.password_hash);
      if (!passwordValid) {
        return reply.status(401).send(INVALID_CREDS_RESPONSE);
      }

      const tokenId = uuidv4();

      const accessToken = app.jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          type: 'access',
        } satisfies Omit<JwtPayload, 'jti'>,
        { expiresIn: ACCESS_TOKEN_TTL },
      );

      const refreshToken = app.jwt.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          type: 'refresh',
          jti: tokenId,
        } satisfies JwtPayload,
        { expiresIn: REFRESH_TOKEN_TTL },
      );

      await app.redis.setex(
        buildRefreshRedisKey(user.id, tokenId),
        REFRESH_TOKEN_TTL_SECONDS,
        '1',
      );

      return reply.send({
        success: true,
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    },
  );

  // POST /api/auth/refresh
  app.post(
    '/api/auth/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: RefreshTokenResponse }> => {
      const body = request.body as { refreshToken: string };

      let payload: JwtPayload;
      try {
        payload = app.jwt.verify<JwtPayload>(body.refreshToken);
      } catch {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Refresh token is invalid or expired',
          },
        });
      }

      if (payload.type !== 'refresh') {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'Refresh token required',
          },
        });
      }

      if (!payload.jti) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'INVALID_REFRESH_TOKEN',
            message: 'Token missing identifier',
          },
        });
      }

      const redisKey = buildRefreshRedisKey(payload.sub, payload.jti);
      const exists = await app.redis.exists(redisKey);

      if (!exists) {
        return reply.status(401).send({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_REVOKED',
            message: 'Refresh token has been revoked',
          },
        });
      }

      // Blacklist old token
      await app.redis.del(redisKey);

      const newTokenId = uuidv4();

      const newAccessToken = app.jwt.sign(
        {
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
          type: 'access',
        } satisfies Omit<JwtPayload, 'jti'>,
        { expiresIn: ACCESS_TOKEN_TTL },
      );

      const newRefreshToken = app.jwt.sign(
        {
          sub: payload.sub,
          email: payload.email,
          role: payload.role,
          type: 'refresh',
          jti: newTokenId,
        } satisfies JwtPayload,
        { expiresIn: REFRESH_TOKEN_TTL },
      );

      await app.redis.setex(
        buildRefreshRedisKey(payload.sub, newTokenId),
        REFRESH_TOKEN_TTL_SECONDS,
        '1',
      );

      return reply.send({
        success: true,
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      });
    },
  );

  // POST /api/auth/logout
  app.post(
    '/api/auth/logout',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply): Promise<{ success: true; data: { message: string } }> => {
      const body = request.body as { refreshToken: string };

      try {
        const payload = app.jwt.verify<JwtPayload>(body.refreshToken);

        if (payload.jti) {
          const redisKey = buildRefreshRedisKey(payload.sub, payload.jti);
          await app.redis.del(redisKey);
        }
      } catch {
        // Even if the token is invalid/expired, respond with success
        // to avoid leaking information
      }

      return reply.send({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    },
  );
}

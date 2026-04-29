import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import {
  BadRequestError,
  ConflictError,
  UnauthorizedError,
} from '../lib/errors.js'

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

const logoutSchema = z.object({
  refreshToken: z.string(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(8),
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Dummy hash for constant-time comparison when user is not found
const DUMMY_HASH = '$2b$12$invalidhashfortimingprotection.donotuse'

function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET is not configured')
  return secret
}

function getJwtRefreshSecret(): string {
  const secret = process.env['JWT_REFRESH_SECRET']
  if (!secret) throw new Error('JWT_REFRESH_SECRET is not configured')
  return secret
}

async function issueTokenPair(
  userId: string,
  redis: import('ioredis').default,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = jwt.sign(
    { sub: userId, type: 'access' },
    getJwtSecret(),
    { expiresIn: '15m' },
  )

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh' },
    getJwtRefreshSecret(),
    { expiresIn: '7d' },
  )

  // Store refresh token in Redis (key: refresh:<userId>:<token>)
  await redis.set(
    `refresh:${userId}:${refreshToken}`,
    '1',
    'EX',
    7 * 24 * 3600,
  )

  return { accessToken, refreshToken }
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/auth/register
  fastify.post('/register', async (request, reply) => {
    const body = registerSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    const { email, password, fullName } = body.data

    const existing = await fastify.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })
    if (existing) {
      throw new ConflictError('email_taken', 'Email is already registered')
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await fastify.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        fullName: fullName ?? null,
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    })

    const tokens = await issueTokenPair(user.id, fastify.redis)

    return reply.code(201).send(tokens)
  })

  // POST /api/auth/login
  fastify.post('/login', async (request, reply) => {
    const body = loginSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    const { email, password } = body.data

    const user = await fastify.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // Constant-time comparison — always compare even if user not found
    const isValid = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    )

    if (!user || !isValid) {
      throw new UnauthorizedError('invalid_credentials', 'Invalid email or password')
    }

    // Check trial expiry → downgrade to free
    if (user.plan === 'trial' && user.trialEndsAt && user.trialEndsAt < new Date()) {
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { plan: 'free' },
      })
    }

    const tokens = await issueTokenPair(user.id, fastify.redis)

    return reply.send(tokens)
  })

  // POST /api/auth/refresh
  fastify.post('/refresh', async (request, reply) => {
    const body = refreshSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    const { refreshToken } = body.data

    let payload: { sub: string; type: string }
    try {
      payload = jwt.verify(refreshToken, getJwtRefreshSecret()) as {
        sub: string
        type: string
      }
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('token_expired', 'Refresh token has expired')
      }
      throw new UnauthorizedError('invalid_token', 'Invalid refresh token')
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedError('invalid_token', 'Token type must be refresh')
    }

    // Verify token is still valid in Redis (not blacklisted)
    const exists = await fastify.redis.get(`refresh:${payload.sub}:${refreshToken}`)
    if (!exists) {
      throw new UnauthorizedError('token_revoked', 'Refresh token has been revoked')
    }

    const accessToken = jwt.sign(
      { sub: payload.sub, type: 'access' },
      getJwtSecret(),
      { expiresIn: '15m' },
    )

    return reply.send({ accessToken })
  })

  // POST /api/auth/logout (requires authentication)
  fastify.post(
    '/logout',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = logoutSchema.safeParse(request.body)
      if (!body.success) {
        throw new BadRequestError('validation_error', body.error.message)
      }

      const { refreshToken } = body.data
      const userId = request.user.id

      await fastify.redis.del(`refresh:${userId}:${refreshToken}`)

      return reply.code(204).send()
    },
  )

  // POST /api/auth/forgot-password
  fastify.post('/forgot-password', async (request, reply) => {
    const body = forgotPasswordSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    const email = body.data.email.toLowerCase().trim()

    // Always return 200 — do not reveal whether email exists
    const user = await fastify.prisma.user.findUnique({ where: { email } })
    if (!user) {
      return reply.send({ ok: true })
    }

    // Rate limit: max 3 reset requests per hour per email
    const rateKey = `reset_rate:${email}`
    const count = await fastify.redis.incr(rateKey)
    if (count === 1) {
      await fastify.redis.expire(rateKey, 3600)
    }
    if (count > 3) {
      // Silent rate limit — don't reveal the limit
      return reply.send({ ok: true })
    }

    const token = randomBytes(32).toString('hex')
    await fastify.redis.set(`reset:${token}`, user.id, 'EX', 3600)

    // TODO: enqueue email via BullMQ worker
    // await bullmq.emailQueue.add('password_reset', { email, token })
    fastify.log.info({ email }, 'Password reset token generated (email sending via worker)')

    return reply.send({ ok: true })
  })

  // POST /api/auth/reset-password
  fastify.post('/reset-password', async (request, reply) => {
    const body = resetPasswordSchema.safeParse(request.body)
    if (!body.success) {
      throw new BadRequestError('validation_error', body.error.message)
    }

    const { token, newPassword } = body.data

    const userId = await fastify.redis.get(`reset:${token}`)
    if (!userId) {
      throw new BadRequestError('token_expired_or_used', 'Password reset token is invalid or expired')
    }

    const hash = await bcrypt.hash(newPassword, 12)

    await fastify.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    })

    // Single-use: delete token
    await fastify.redis.del(`reset:${token}`)

    return reply.send({ ok: true })
  })
}

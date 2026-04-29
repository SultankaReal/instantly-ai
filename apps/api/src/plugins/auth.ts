import fp from 'fastify-plugin'
import jwt from 'jsonwebtoken'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { UnauthorizedError } from '../lib/errors.js'

interface JwtPayload {
  sub: string
  type: string
  iat?: number
  exp?: number
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
  interface FastifyRequest {
    user: {
      id: string
    }
  }
}

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const authHeader = request.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        throw new UnauthorizedError('unauthorized', 'Missing or invalid authorization header')
      }

      const token = authHeader.slice(7)
      const secret = process.env['JWT_SECRET']
      if (!secret) throw new Error('JWT_SECRET is not configured')

      let payload: JwtPayload
      try {
        payload = jwt.verify(token, secret) as JwtPayload
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new UnauthorizedError('token_expired', 'Access token has expired')
        }
        throw new UnauthorizedError('invalid_token', 'Invalid access token')
      }

      if (payload.type !== 'access') {
        throw new UnauthorizedError('invalid_token', 'Token type must be access')
      }

      request.user = { id: payload.sub }
    },
  )
}

export default fp(authPlugin, { name: 'auth' })

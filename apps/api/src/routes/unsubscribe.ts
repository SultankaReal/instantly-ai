import type { FastifyPluginAsync } from 'fastify'
import { BadRequestError } from '../lib/errors.js'
import { verifyUnsubscribeToken } from '../lib/unsubscribe-token.js'

export const unsubscribeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /unsubscribe?token=xxx — no auth required (38-ФЗ compliance)
  fastify.get<{ Querystring: { token?: string } }>(
    '/unsubscribe',
    async (request, reply) => {
      const { token } = request.query

      if (!token) {
        throw new BadRequestError('missing_token', 'Unsubscribe token is required')
      }

      let email: string
      try {
        email = verifyUnsubscribeToken(token)
      } catch {
        return reply
          .code(400)
          .header('Content-Type', 'text/html; charset=utf-8')
          .send(`
            <!DOCTYPE html>
            <html lang="ru">
            <head><meta charset="utf-8"><title>Ошибка</title></head>
            <body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; text-align: center;">
              <h2>Недействительная ссылка</h2>
              <p>Ссылка для отписки устарела или недействительна.</p>
            </body>
            </html>
          `)
      }

      // Add to global unsubscribe list and update contact status
      await Promise.all([
        fastify.prisma.unsubscribe.upsert({
          where: { email },
          create: { email, reason: 'link' },
          update: { reason: 'link', unsubscribedAt: new Date() },
        }),
        fastify.prisma.contact.updateMany({
          where: { email },
          data: { status: 'unsubscribed' },
        }),
      ])

      fastify.log.info({ email }, 'User unsubscribed via link')

      return reply
        .code(200)
        .header('Content-Type', 'text/html; charset=utf-8')
        .send(`
          <!DOCTYPE html>
          <html lang="ru">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Вы отписаны</title>
          </head>
          <body style="font-family: sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; text-align: center;">
            <h2>Вы отписаны</h2>
            <p>Адрес <strong>${escapeHtml(email)}</strong> удалён из списка рассылки.</p>
            <p style="color: #888; font-size: 14px;">Вы больше не будете получать письма от этого отправителя.</p>
          </body>
          </html>
        `)
    },
  )
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

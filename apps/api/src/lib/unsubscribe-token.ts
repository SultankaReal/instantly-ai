import { createHmac } from 'node:crypto'

const UNSUBSCRIBE_SECRET = process.env['UNSUBSCRIBE_TOKEN_SECRET'] ?? 'change-me-in-production'

/**
 * Generates an HMAC-signed unsubscribe token for an email address.
 * Format: base64url(<email>.<hmac>)
 */
export function generateUnsubscribeToken(email: string): string {
  const hmac = createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(email.toLowerCase())
    .digest('hex')
  const payload = `${email.toLowerCase()}.${hmac}`
  return Buffer.from(payload).toString('base64url')
}

/**
 * Verifies an unsubscribe token and returns the email if valid.
 * Throws BadRequestError if token is invalid.
 */
export function verifyUnsubscribeToken(token: string): string {
  let payload: string
  try {
    payload = Buffer.from(token, 'base64url').toString('utf8')
  } catch {
    throw new Error('invalid_token')
  }

  const lastDotIndex = payload.lastIndexOf('.')
  if (lastDotIndex === -1) throw new Error('invalid_token')

  const email = payload.slice(0, lastDotIndex)
  const providedHmac = payload.slice(lastDotIndex + 1)

  const expectedHmac = createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(email)
    .digest('hex')

  // Constant-time comparison
  if (providedHmac.length !== expectedHmac.length) throw new Error('invalid_token')
  let diff = 0
  for (let i = 0; i < expectedHmac.length; i++) {
    diff |= providedHmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i)
  }
  if (diff !== 0) throw new Error('invalid_token')

  return email
}

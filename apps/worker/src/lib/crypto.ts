import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

// Format: iv(12 bytes) + authTag(16 bytes) + ciphertext
export async function encryptAES256GCM(data: string, keyHex: string): Promise<Buffer> {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted])
}

export async function decryptAES256GCM(data: Buffer, keyHex: string): Promise<string> {
  const key = Buffer.from(keyHex, 'hex')
  const iv = data.subarray(0, 12)
  const tag = data.subarray(12, 28)
  const ciphertext = data.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}

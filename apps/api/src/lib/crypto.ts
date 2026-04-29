import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12    // 96-bit IV for GCM
const TAG_LENGTH = 16   // 128-bit auth tag

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format (Buffer): [iv (12 bytes)] [tag (16 bytes)] [ciphertext]
 */
export function encryptAES256GCM(plaintext: string, keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits)')
  }

  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  // Layout: iv (12) | tag (16) | ciphertext
  return Buffer.concat([iv, tag, ciphertext])
}

/**
 * Decrypts AES-256-GCM encrypted data.
 * Expects Buffer with layout: [iv (12 bytes)] [tag (16 bytes)] [ciphertext]
 */
export function decryptAES256GCM(encrypted: Buffer, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex')
  if (key.length !== 32) {
    throw new Error('Encryption key must be 32 bytes (256 bits)')
  }

  if (encrypted.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Encrypted data is too short')
  }

  const iv = encrypted.subarray(0, IV_LENGTH)
  const tag = encrypted.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = encrypted.subarray(IV_LENGTH + TAG_LENGTH)

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

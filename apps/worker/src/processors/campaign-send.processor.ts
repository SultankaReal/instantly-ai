import { Job } from 'bullmq'
import { createHmac } from 'crypto'
import nodemailer from 'nodemailer'
import { prisma } from '../lib/prisma'
import { decryptAES256GCM } from '../lib/crypto'

type EmailSendJob = {
  sendId: string
  campaignId: string
  stepId: string
  contactId: string
  accountId: string
  toEmail: string
  subject: string
  bodyHtml: string
}

type DecryptedCredentials = {
  email: string
  password: string
}

function appendUnsubscribeLink(html: string, email: string, baseUrl: string): string {
  const token = createHmac('sha256', process.env['ENCRYPTION_KEY']!)
    .update(email)
    .digest('hex')
  const link = `${baseUrl}/unsubscribe?token=${token}&email=${encodeURIComponent(email)}`
  return (
    html +
    `\n<p style="font-size:11px;color:#999;margin-top:32px;"><a href="${link}" style="color:#999;">Отписаться от рассылки</a></p>`
  )
}

export async function campaignSendProcessor(job: Job<EmailSendJob>): Promise<void> {
  const { sendId, contactId, accountId, toEmail, subject, campaignId } = job.data
  let { bodyHtml } = job.data

  // 1. Load account and decrypt SMTP credentials
  const account = await prisma.emailAccount.findUniqueOrThrow({
    where: { id: accountId },
  })

  const credsJson = await decryptAES256GCM(
    account.credentialsEnc,
    process.env['ENCRYPTION_KEY']!,
  )
  const creds: DecryptedCredentials = JSON.parse(credsJson)

  // 2. Verify contact not in unsubscribes table
  const isUnsubscribed = await prisma.unsubscribe.findFirst({
    where: { email: toEmail },
  })

  if (isUnsubscribed) {
    await prisma.emailSend.update({
      where: { id: sendId },
      data: { status: 'skipped' },
    })
    return
  }

  // 3. Verify contact is still active
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
  })

  if (contact.status !== 'active') {
    await prisma.emailSend.update({
      where: { id: sendId },
      data: { status: 'skipped' },
    })
    return
  }

  // 4. Append unsubscribe link (38-ФЗ compliance)
  const baseUrl = process.env['APP_URL'] ?? 'https://potok.app'
  bodyHtml = appendUnsubscribeLink(bodyHtml, toEmail, baseUrl)

  // 5. Send via Nodemailer
  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: {
      user: creds.email,
      pass: creds.password,
    },
    tls: { rejectUnauthorized: false },
  })

  try {
    const info = await transporter.sendMail({
      from: creds.email,
      to: toEmail,
      subject,
      html: bodyHtml,
      headers: {
        'X-Campaign-Id': campaignId,
        'X-Send-Id': sendId,
      },
    })

    const messageId = info.messageId as string

    // 6. Update email_sends.status = 'sent', sent_at = now()
    await prisma.emailSend.update({
      where: { id: sendId },
      data: {
        status: 'sent',
        messageId,
        sentAt: new Date(),
      },
    })
  } catch (err) {
    const smtpError = err as NodeJS.ErrnoException & { responseCode?: number }

    // Permanent failure (5xx) → mark bounced
    if (smtpError.responseCode !== undefined && smtpError.responseCode >= 500) {
      await prisma.emailSend.update({
        where: { id: sendId },
        data: { status: 'bounced', bouncedAt: new Date() },
      })
      await prisma.contact.update({
        where: { id: contactId },
        data: { status: 'bounced' },
      })
      await prisma.unsubscribe.upsert({
        where: { email: toEmail },
        create: { email: toEmail, campaignId, reason: 'bounce' },
        update: {},
      })
      // Don't rethrow permanent failures — no retry
      return
    }

    // Transient failure (4xx) → rethrow for BullMQ retry
    throw err
  }
}

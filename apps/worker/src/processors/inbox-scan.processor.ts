import { Job } from 'bullmq'
import { ImapFlow } from 'imapflow'
import { prisma } from '../lib/prisma'
import { decryptAES256GCM } from '../lib/crypto'
import { aiReplyQueue } from '../queues/index'

type InboxScanJob = {
  accountId: string
  since?: Date
}

type DecryptedCredentials = {
  email: string
  password: string
}

export async function inboxScanProcessor(job: Job<InboxScanJob>): Promise<void> {
  const { accountId } = job.data
  const since = job.data.since ? new Date(job.data.since) : undefined

  // 1. Load account and decrypt credentials
  const account = await prisma.emailAccount.findUniqueOrThrow({
    where: { id: accountId },
  })

  const credsJson = await decryptAES256GCM(
    account.credentialsEnc,
    process.env['ENCRYPTION_KEY']!,
  )
  const creds: DecryptedCredentials = JSON.parse(credsJson)

  const scanSince = since ?? account.lastScannedAt ?? new Date(Date.now() - 60 * 60 * 1000)

  const imapClient = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapPort === 993,
    auth: {
      user: creds.email,
      pass: creds.password,
    },
    logger: false,
  })

  try {
    await imapClient.connect()
    await imapClient.mailboxOpen('INBOX')

    // 2. Search for replies since job.since date
    const messages = imapClient.fetch(
      { since: scanSince },
      { envelope: true, bodyStructure: true, source: true },
    )

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: account.userId },
    })

    for await (const msg of messages) {
      const messageId = msg.envelope?.messageId ?? `${accountId}-${msg.uid}`
      const inReplyTo = msg.envelope?.inReplyTo ?? undefined

      // Skip if already processed
      const existing = await prisma.inboxMessage.findFirst({
        where: { accountId, messageId },
      })
      if (existing) continue

      // 3. Try to link to a campaign send (by Message-ID threading)
      let relatedSend = null
      if (inReplyTo) {
        relatedSend = await prisma.emailSend.findFirst({
          where: {
            messageId: inReplyTo,
            accountId,
          },
        })
      }

      const fromEmail = msg.envelope?.from?.[0]?.address ?? ''
      const fromName = msg.envelope?.from?.[0]?.name ?? ''
      const subject = msg.envelope?.subject ?? ''

      // Extract body text from source
      const rawSource = msg.source ? msg.source.toString('utf8') : ''
      // Simple extraction: take text after headers
      const bodyText = rawSource.split('\r\n\r\n').slice(1).join('\r\n\r\n').slice(0, 5000)

      // 4. Save to unified inbox
      const inboxMessage = await prisma.inboxMessage.create({
        data: {
          userId: account.userId,
          accountId,
          sendId: relatedSend?.id ?? null,
          messageId,
          fromEmail,
          fromName,
          subject,
          bodyText,
          bodyHtml: null, // sanitize only at render time
          receivedAt: msg.envelope?.date ?? new Date(),
        },
      })

      // 5. Update send status if linked
      if (relatedSend) {
        await prisma.emailSend.update({
          where: { id: relatedSend.id },
          data: { status: 'replied', repliedAt: new Date() },
        })

        // Cancel remaining queued steps for that contact in the campaign
        await prisma.emailSend.updateMany({
          where: {
            campaignId: relatedSend.campaignId,
            contactId: relatedSend.contactId,
            status: 'queued',
          },
          data: { status: 'cancelled' },
        })
      }

      // 6. Enqueue AIReplyJob if user has AI reply enabled
      const isPaidPlan = user.plan === 'pro' || user.plan === 'agency'
      if (isPaidPlan && (user as { aiReplyEnabled?: boolean }).aiReplyEnabled) {
        const aiMode = (user as { aiReplyMode?: string }).aiReplyMode ?? 'draft'
        const confidenceThreshold =
          (user as { aiConfidenceThreshold?: number }).aiConfidenceThreshold ?? 85

        await aiReplyQueue.add('ai-reply', {
          messageId: inboxMessage.id,
          userId: account.userId,
          mode: aiMode as 'autopilot' | 'draft' | 'manual',
          confidenceThreshold,
        })
      }
    }

    // 7. Update lastScannedAt
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastScannedAt: new Date() },
    })
  } finally {
    // Always close IMAP connection
    await imapClient.logout()
  }
}

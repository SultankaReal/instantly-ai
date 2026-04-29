import { Job } from 'bullmq'
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { prisma } from '../lib/prisma'
import { decryptAES256GCM } from '../lib/crypto'

type WarmupSendJob = {
  accountId: string
  partnerId: string
  partnerEmail: string
}

type DecryptedCredentials = {
  email: string
  password: string
}

const WARMUP_RAMP = [
  { maxDay: 7, min: 5, max: 10 },
  { maxDay: 14, min: 20, max: 40 },
  { maxDay: 21, min: 40, max: 100 },
  { maxDay: 999, min: 100, max: 200 },
] as const

const WARMUP_SUBJECTS = [
  'Привет, как дела?',
  'Интересный вопрос',
  'Нужен твой совет',
  'Есть минута?',
  'Хотел уточнить кое-что',
  'Мысли по этому поводу',
  'Небольшой вопрос',
  'Твоё мнение важно',
  'Хочу поделиться идеей',
  'Давно не общались',
  'Важная информация',
  'Быстрый вопрос',
  'Можем поговорить?',
  'Проверяю связь',
  'Напоминание',
  'Обновление по проекту',
  'Следующий шаг',
  'Краткая заметка',
  'Как продвигается работа?',
  'Последующее сообщение',
]

function getDailyVolume(warmupDay: number): number {
  const ramp =
    WARMUP_RAMP.find((r) => warmupDay <= r.maxDay) ?? WARMUP_RAMP[WARMUP_RAMP.length - 1]!
  return Math.floor(Math.random() * (ramp.max - ramp.min + 1)) + ramp.min
}

function generateWarmupBody(): string {
  const bodies = [
    'Хотел поинтересоваться, как идут дела на этой неделе. Есть время для краткого разговора? Буду рад обменяться мнениями.',
    'Пишу, чтобы оставаться на связи. Недавно думал о нашем последнем разговоре. Интересно было бы продолжить обсуждение.',
    'Просто проверяю, всё ли хорошо с твоей стороны. Если есть что обсудить — буду рад помочь или просто поговорить.',
    'Давно не общались. Хотел напомнить о себе и узнать, как твои дела. Надеюсь, всё идёт по плану.',
    'Недавно наткнулся на кое-что интересное и подумал о тебе. Напиши, когда будет время — хочу поделиться.',
  ]
  return bodies[Math.floor(Math.random() * bodies.length)] ?? bodies[0]!
}

function generateWarmupReply(originalBody: string): string {
  const replies = [
    `Спасибо за письмо! Всё хорошо, продолжаем работать над проектами. ${originalBody.slice(0, 30)}... — хорошая мысль. Ответить подробнее смогу чуть позже.`,
    'Привет! Получил твоё сообщение. Дела идут хорошо, спасибо что написал. Обязательно вернусь с ответом.',
    'Спасибо, что не забываешь! Сейчас немного занят, но твоё письмо прочитал. Свяжусь с тобой в ближайшее время.',
    'Привет! Рад получить весточку. У меня всё нормально. Давай поговорим подробнее, когда выберу время.',
    'Отлично, что написал! Всё в порядке. Буду рад продолжить общение — напишу позже с подробностями.',
  ]
  return replies[Math.floor(Math.random() * replies.length)] ?? replies[0]!
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomMs(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function sendSmtp(options: {
  from: string
  to: string
  subject: string
  text: string
  smtpHost: string
  smtpPort: number
  user: string
  password: string
}): Promise<string> {
  const transporter = nodemailer.createTransport({
    host: options.smtpHost,
    port: options.smtpPort,
    secure: options.smtpPort === 465,
    auth: {
      user: options.user,
      pass: options.password,
    },
    tls: { rejectUnauthorized: false },
  })

  const info = await transporter.sendMail({
    from: options.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
  })

  return info.messageId as string
}

export async function warmupSendProcessor(job: Job<WarmupSendJob>): Promise<void> {
  const { accountId, partnerId } = job.data

  // 1. Load accounts from DB
  const senderAccount = await prisma.emailAccount.findUniqueOrThrow({
    where: { id: accountId },
  })
  const partnerAccount = await prisma.emailAccount.findUniqueOrThrow({
    where: { id: partnerId },
  })

  // 2. Decrypt credentials for both
  const senderCredsJson = await decryptAES256GCM(
    senderAccount.credentialsEnc,
    process.env['ENCRYPTION_KEY']!,
  )
  const partnerCredsJson = await decryptAES256GCM(
    partnerAccount.credentialsEnc,
    process.env['ENCRYPTION_KEY']!,
  )

  const senderCreds: DecryptedCredentials = JSON.parse(senderCredsJson)
  const partnerCreds: DecryptedCredentials = JSON.parse(partnerCredsJson)

  // 3. Calculate warmup day and daily volume
  const warmupStartedAt = senderAccount.warmupStartedAt ?? new Date()
  const warmupDay = Math.floor(
    (Date.now() - warmupStartedAt.getTime()) / (1000 * 60 * 60 * 24),
  )
  const _dailyVolume = getDailyVolume(warmupDay)

  // 4. Send warmup email (sender → partner)
  const subject = WARMUP_SUBJECTS[Math.floor(Math.random() * WARMUP_SUBJECTS.length)]!
  const bodyText = generateWarmupBody()

  const messageId = await sendSmtp({
    from: senderCreds.email,
    to: partnerCreds.email,
    subject,
    text: bodyText,
    smtpHost: senderAccount.smtpHost,
    smtpPort: senderAccount.smtpPort,
    user: senderCreds.email,
    password: senderCreds.password,
  })

  // 5. Record warmup_event 'sent'
  await prisma.warmupEvent.create({
    data: {
      accountId,
      eventType: 'sent',
      partnerAccount: partnerCreds.email,
    },
  })

  // 6. Wait before checking IMAP (human-like delay)
  await sleep(randomMs(30_000, 5 * 60_000))

  // 7. Check IMAP inbox on partner account
  const imapClient = new ImapFlow({
    host: partnerAccount.imapHost,
    port: partnerAccount.imapPort,
    secure: partnerAccount.imapPort === 993,
    auth: {
      user: partnerCreds.email,
      pass: partnerCreds.password,
    },
    logger: false,
  })

  try {
    await imapClient.connect()

    // Search for our email in INBOX
    const mailbox = await imapClient.mailboxOpen('INBOX')
    const since = new Date(Date.now() - 15 * 60 * 1000) // last 15 min

    let inboxLanded = false
    let inboxUid: number | undefined

    if (mailbox.exists > 0) {
      const messages = imapClient.fetch(
        { since },
        { envelope: true, flags: true },
      )

      for await (const msg of messages) {
        const msgId = msg.envelope.messageId ?? ''
        if (msgId === messageId || msg.envelope.from?.[0]?.address === senderCreds.email) {
          inboxLanded = true
          inboxUid = msg.uid
          break
        }
      }
    }

    if (inboxLanded && inboxUid !== undefined) {
      // Mark as read (signals engagement to ESP)
      await imapClient.messageFlagsAdd({ uid: inboxUid }, ['\\Seen'])

      await prisma.warmupEvent.create({
        data: {
          accountId,
          eventType: 'received',
          partnerAccount: partnerCreds.email,
        },
      })

      // 8. With 15% probability → send reply from partner account
      if (Math.random() < 0.15) {
        const replyBody = generateWarmupReply(bodyText)
        await sendSmtp({
          from: partnerCreds.email,
          to: senderCreds.email,
          subject: `Re: ${subject}`,
          text: replyBody,
          smtpHost: partnerAccount.smtpHost,
          smtpPort: partnerAccount.smtpPort,
          user: partnerCreds.email,
          password: partnerCreds.password,
        })

        await prisma.warmupEvent.create({
          data: {
            accountId,
            eventType: 'replied',
            partnerAccount: partnerCreds.email,
          },
        })
      }
    } else {
      // Check Spam folder
      const spamFolders = ['Spam', 'Junk', '[Gmail]/Spam', 'Спам']
      let movedFromSpam = false

      for (const spamFolder of spamFolders) {
        try {
          await imapClient.mailboxOpen(spamFolder)
          const spamMessages = imapClient.fetch(
            { since },
            { envelope: true },
          )

          for await (const msg of spamMessages) {
            if (msg.envelope.from?.[0]?.address === senderCreds.email) {
              // Move from Spam to INBOX (critical: ESP sees this as "not spam")
              await imapClient.messageMove({ uid: msg.uid }, 'INBOX')
              movedFromSpam = true
              break
            }
          }

          if (movedFromSpam) break
        } catch {
          // Folder doesn't exist, try next
          continue
        }
      }

      if (movedFromSpam) {
        await prisma.warmupEvent.create({
          data: {
            accountId,
            eventType: 'moved_from_spam',
            partnerAccount: partnerCreds.email,
          },
        })
      }
    }

    // 9. Update inbox_score_snapshots
    const recentEvents = await prisma.warmupEvent.findMany({
      where: {
        accountId,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    })

    const sent = recentEvents.filter((e) => e.eventType === 'sent').length
    const received = recentEvents.filter((e) => e.eventType === 'received').length
    const movedCount = recentEvents.filter((e) => e.eventType === 'moved_from_spam').length

    if (sent > 0) {
      const weightedReceived = received + movedCount * 0.5
      const score = Math.max(0, Math.min(100, Math.round((weightedReceived / sent) * 100)))

      await prisma.inboxScoreSnapshot.create({
        data: {
          accountId,
          score,
          provider: 'combined',
          snapshottedAt: new Date(),
        },
      })

      await prisma.emailAccount.update({
        where: { id: accountId },
        data: { inboxScore: score },
      })
    }
  } finally {
    await imapClient.logout()
  }
}

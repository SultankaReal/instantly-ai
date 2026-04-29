import { Job } from 'bullmq'
import Anthropic from '@anthropic-ai/sdk'
import nodemailer from 'nodemailer'
import { prisma } from '../lib/prisma'
import { decryptAES256GCM } from '../lib/crypto'

type AIReplyJob = {
  messageId: string
  userId: string
  mode: 'autopilot' | 'draft' | 'manual'
  confidenceThreshold: number
}

type Classification = {
  category:
    | 'interested'
    | 'meeting_request'
    | 'not_now'
    | 'not_interested'
    | 'unsubscribe'
    | 'objection'
    | 'question'
    | 'out_of_office'
    | 'spam_complaint'
  confidence: number
  reasoning: string
}

type DecryptedCredentials = {
  email: string
  password: string
}

const anthropic = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY']!,
})

async function classifyReply(bodyText: string): Promise<Classification> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: `Классифицируй ответ на холодное письмо. Верни ТОЛЬКО JSON без пояснений:
{ "category": "<одно из: interested|meeting_request|not_now|not_interested|unsubscribe|objection|question|out_of_office|spam_complaint>", "confidence": <0-100>, "reasoning": "<1 предложение>" }`,
    messages: [
      {
        role: 'user',
        content: `Ответ на письмо: "${bodyText.slice(0, 500)}"`,
      },
    ],
  })

  const textBlock = response.content[0]
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Unexpected response format from Anthropic')
  }

  try {
    return JSON.parse(textBlock.text) as Classification
  } catch {
    throw new Error(`Failed to parse classification response: ${textBlock.text}`)
  }
}

async function generateAIReply(
  bodyText: string,
  threadContext: string,
  productDescription: string | null,
): Promise<string> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: `Ты профессиональный менеджер по продажам. Пишешь деловые письма на русском языке.
Краткость важнее объёма. Не используй обращения "Уважаемый", "С уважением".
Пиши как живой человек, не как корпоративный шаблон.${productDescription ? `\nКонтекст продукта: ${productDescription}` : ''}`,
    messages: [
      {
        role: 'user',
        content: `История переписки:\n${threadContext}\n\nПоследний ответ:\n${bodyText}\n\nНапиши ответ:`,
      },
    ],
  })

  const textBlock = response.content[0]
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Unexpected response format from Anthropic')
  }

  return textBlock.text
}

function determineAction(
  cl: Classification,
  mode: 'autopilot' | 'draft' | 'manual',
  threshold: number,
): 'autopilot' | 'draft' | 'stop_sequence' | 'postpone' | 'notify' {
  const stopCategories = ['unsubscribe', 'spam_complaint', 'not_interested'] as const
  if (stopCategories.includes(cl.category as (typeof stopCategories)[number])) {
    return 'stop_sequence'
  }

  if (cl.category === 'out_of_office') {
    return 'postpone'
  }

  if (mode === 'manual') {
    return 'notify'
  }

  const autoCategories = ['interested', 'meeting_request', 'question'] as const
  if (
    mode === 'autopilot' &&
    cl.confidence >= threshold &&
    autoCategories.includes(cl.category as (typeof autoCategories)[number])
  ) {
    return 'autopilot'
  }

  return 'draft'
}

function mapCategoryToLeadStatus(
  category: Classification['category'],
): 'interested' | 'not_interested' | 'callback' | 'spam' | null {
  switch (category) {
    case 'interested':
    case 'meeting_request':
    case 'question':
    case 'not_now':
      return 'interested'
    case 'not_interested':
    case 'objection':
      return 'not_interested'
    case 'out_of_office':
      return 'callback'
    case 'unsubscribe':
    case 'spam_complaint':
      return 'spam'
    default:
      return null
  }
}

export async function aiReplyProcessor(job: Job<AIReplyJob>): Promise<void> {
  const { messageId, userId, mode, confidenceThreshold } = job.data

  // 1. Load inbox_message from DB
  const message = await prisma.inboxMessage.findUniqueOrThrow({
    where: { id: messageId },
  })

  const account = await prisma.emailAccount.findUniqueOrThrow({
    where: { id: message.accountId },
  })

  // 2. Build conversation context (last 4 messages in thread)
  const threadMessages = await prisma.inboxMessage.findMany({
    where: { accountId: message.accountId, fromEmail: message.fromEmail },
    orderBy: { receivedAt: 'asc' },
    take: 4,
  })

  const threadContext = threadMessages
    .map((m) => `${m.fromEmail}: ${m.bodyText.slice(0, 300)}`)
    .join('\n\n')

  // Load campaign context if linked
  let productDescription: string | null = null
  if (message.sendId) {
    const send = await prisma.emailSend.findUnique({
      where: { id: message.sendId },
      include: { campaign: true },
    })
    productDescription = (send?.campaign as { productDescription?: string })?.productDescription ?? null
  }

  // 3. Call Anthropic Claude API to classify reply
  const classification = await classifyReply(message.bodyText)

  // 4. Determine action
  const action = determineAction(classification, mode, confidenceThreshold)

  // 5. Execute action
  if (action === 'stop_sequence') {
    // Cancel remaining queued sends for this contact
    if (message.sendId) {
      const send = await prisma.emailSend.findUnique({ where: { id: message.sendId } })
      if (send) {
        await prisma.emailSend.updateMany({
          where: {
            campaignId: send.campaignId,
            contactId: send.contactId,
            status: 'queued',
          },
          data: { status: 'cancelled' },
        })
      }
    }

    // If DO_NOT_CONTACT / unsubscribe: add to unsubscribes
    if (classification.category === 'unsubscribe' || classification.category === 'spam_complaint') {
      await prisma.contact.updateMany({
        where: { email: message.fromEmail, userId },
        data: { status: 'unsubscribed' },
      })
      await prisma.unsubscribe.upsert({
        where: { email: message.fromEmail },
        create: { email: message.fromEmail, reason: 'manual' },
        update: { reason: 'manual' },
      })
    }

    await prisma.inboxMessage.update({
      where: { id: messageId },
      data: {
        aiCategory: classification.category,
        aiConfidence: classification.confidence,
        leadStatus: mapCategoryToLeadStatus(classification.category),
      },
    })
    return
  }

  if (action === 'postpone') {
    // Out of office: postpone follow-up by 3 days
    if (message.sendId) {
      const send = await prisma.emailSend.findUnique({ where: { id: message.sendId } })
      if (send) {
        const postponeUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
        await prisma.emailSend.updateMany({
          where: {
            campaignId: send.campaignId,
            contactId: send.contactId,
            status: 'queued',
          },
          data: { scheduledAt: postponeUntil },
        })
      }
    }

    await prisma.inboxMessage.update({
      where: { id: messageId },
      data: { aiCategory: 'out_of_office' },
    })
    return
  }

  if (action === 'notify') {
    // Manual mode: just update category, human will reply
    await prisma.inboxMessage.update({
      where: { id: messageId },
      data: {
        aiCategory: classification.category,
        aiConfidence: classification.confidence,
        leadStatus: mapCategoryToLeadStatus(classification.category),
      },
    })
    return
  }

  // Generate AI draft (for 'draft' or 'autopilot' actions)
  const draft = await generateAIReply(message.bodyText, threadContext, productDescription)

  await prisma.inboxMessage.update({
    where: { id: messageId },
    data: {
      aiDraft: draft,
      aiCategory: classification.category,
      aiConfidence: classification.confidence,
      leadStatus: mapCategoryToLeadStatus(classification.category),
    },
  })

  if (action === 'autopilot') {
    // Auto-send without user review
    const credsJson = await decryptAES256GCM(
      account.credentialsEnc,
      process.env['ENCRYPTION_KEY']!,
    )
    const creds: DecryptedCredentials = JSON.parse(credsJson)

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

    await transporter.sendMail({
      from: creds.email,
      to: message.fromEmail,
      subject: `Re: ${message.subject}`,
      text: draft,
    })

    await prisma.inboxMessage.update({
      where: { id: messageId },
      data: { aiSentAt: new Date() },
    })
  }
  // action === 'draft': user sees draft in unified inbox → edits → sends manually
}

// Database entity interfaces matching the PostgreSQL DDL from Specification.md

export type Plan = 'trial' | 'starter' | 'pro' | 'agency'
export type AccountStatus = 'connected' | 'warming' | 'paused' | 'error'
export type CampaignStatus = 'draft' | 'running' | 'paused' | 'completed'
export type SendStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'replied'
  | 'bounced'
  | 'skipped'
  | 'cancelled'
export type LeadStatus = 'interested' | 'not_interested' | 'callback' | 'spam'
export type ReplyCategory =
  | 'interested'
  | 'meeting_request'
  | 'not_now'
  | 'not_interested'
  | 'unsubscribe'
  | 'objection'
  | 'question'
  | 'out_of_office'
  | 'spam_complaint'
export type WarmupEventType = 'sent' | 'received' | 'moved_from_spam' | 'opened' | 'replied'

export type ContactStatus = 'active' | 'unsubscribed' | 'bounced'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due'
export type AIReplyMode = 'draft' | 'autopilot' | 'manual'
export type BillingPeriod = 'monthly' | 'annual'
export type InboxScoreProvider = 'yandex' | 'mailru' | 'gmail' | 'combined'
export type AlertType = 'score_drop' | 'dns_fail' | 'smtp_error' | 'imap_error' | 'daily_limit_reached'

// users table
export interface User {
  id: string
  email: string
  passwordHash: string
  fullName: string | null
  plan: Plan
  trialEndsAt: Date | null
  aiReplyEnabled: boolean
  aiReplyMode: AIReplyMode
  aiConfidenceThreshold: number
  createdAt: Date
  updatedAt: Date
}

// email_accounts table
export interface EmailAccount {
  id: string
  userId: string
  email: string
  displayName: string | null
  smtpHost: string
  smtpPort: number
  imapHost: string
  imapPort: number
  credentialsEnc: Uint8Array
  status: AccountStatus
  inboxScore: number
  dailyLimit: number
  inWarmupPool: boolean
  warmupStartedAt: Date | null
  lastScannedAt: Date | null
  dnsSpf: boolean | null
  dnsDkim: boolean | null
  dnsDmarc: boolean | null
  dnsCheckedAt: Date | null
  renewalAttempts: number
  createdAt: Date
}

// warmup_events table
export interface WarmupEvent {
  id: string
  accountId: string
  eventType: WarmupEventType
  partnerAccount: string | null
  inboxScoreAt: number | null
  createdAt: Date
}

// inbox_score_snapshots table
export interface InboxScoreSnapshot {
  id: string
  accountId: string
  score: number
  provider: InboxScoreProvider
  snapshottedAt: Date
}

// campaigns table
export interface Campaign {
  id: string
  userId: string
  name: string
  status: CampaignStatus
  fromAccountId: string | null
  scheduleDays: string[]
  scheduleStart: string
  scheduleEnd: string
  timezone: string
  dailyLimit: number
  createdAt: Date
  updatedAt: Date
}

// campaign_steps table
export interface CampaignStep {
  id: string
  campaignId: string
  stepNumber: number
  subject: string
  bodyHtml: string
  delayDays: number
}

// contacts table
export interface Contact {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  company: string | null
  position: string | null
  customVars: Record<string, unknown>
  status: ContactStatus
  createdAt: Date
}

// email_sends table
export interface EmailSend {
  id: string
  campaignId: string
  stepId: string
  contactId: string
  accountId: string
  status: SendStatus
  messageId: string | null
  openedAt: Date | null
  repliedAt: Date | null
  bouncedAt: Date | null
  sentAt: Date | null
  createdAt: Date
}

// inbox_messages table
export interface InboxMessage {
  id: string
  userId: string
  accountId: string
  sendId: string | null
  fromEmail: string
  fromName: string | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  isRead: boolean
  leadStatus: LeadStatus | null
  aiDraft: string | null
  aiCategory: ReplyCategory | null
  aiConfidence: number | null
  aiSentAt: Date | null
  messageId: string | null
  receivedAt: Date
}

// subscriptions table
export interface Subscription {
  id: string
  userId: string
  plan: Plan
  status: SubscriptionStatus
  yookassaPaymentId: string | null
  yookassaPaymentMethodId: string | null
  amount: number
  billingPeriod: BillingPeriod
  currentPeriodStart: Date | null
  currentPeriodEnd: Date | null
  cancelledAt: Date | null
  renewalAttempts: number
  renewalAttemptAt: Date | null
  createdAt: Date
}

// payment_events table
export interface PaymentEvent {
  id: string
  userId: string
  eventType: string
  yookassaEventId: string | null
  amount: number | null
  payload: Record<string, unknown> | null
  createdAt: Date
}

// unsubscribes table
export interface Unsubscribe {
  email: string
  reason: string | null
  unsubscribedAt: Date
}

// inbox_alerts table
export interface InboxAlert {
  id: string
  accountId: string
  alertType: AlertType
  message: string
  isRead: boolean
  createdAt: Date
}

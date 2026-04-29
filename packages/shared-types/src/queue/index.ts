// BullMQ job data types — all job payloads for apps/worker

import type { Plan } from '../models/index.js'

/**
 * Warmup pool: send a warmup email between two partner accounts.
 * Queue: warmup-send
 */
export type WarmupSendJob = {
  accountId: string
  partnerId: string
  partnerEmail: string
}

/**
 * Campaign sequence: send one campaign email to one contact.
 * subject and bodyHtml arrive already variable-substituted and DOMPurified.
 * Queue: email-send
 */
export type EmailSendJob = {
  sendId: string
  campaignId: string
  stepId: string
  contactId: string
  accountId: string
  toEmail: string
  subject: string
  bodyHtml: string
}

/**
 * Inbox scan: pull new messages via IMAP for a given account.
 * Queue: inbox-scan
 */
export type InboxScanJob = {
  accountId: string
  since: Date
}

/**
 * AI Reply Agent: classify and optionally auto-reply to an inbox message.
 * Queue: ai-reply
 */
export type AIReplyJob = {
  messageId: string
  userId: string
  mode: 'autopilot' | 'draft' | 'manual'
  confidenceThreshold: number
}

/**
 * DNS health check: verify SPF, DKIM, DMARC for an account's domain.
 * Queue: dns-check
 */
export type DnsCheckJob = {
  accountId: string
  domain: string
}

/**
 * Recurring billing: attempt renewal charge for a subscription.
 * Queue: recurring-billing
 */
export type RecurringBillingJob = {
  subscriptionId: string
}

/**
 * Plan downgrade: apply a scheduled plan downgrade after billing failure.
 * Queue: downgrade-plan
 */
export type DowngradePlanJob = {
  userId: string
  newPlan: Plan
}

/**
 * Inbox score calculation: recalculate and snapshot score for an account.
 * Queue: inbox-score
 */
export type InboxScoreJob = {
  accountId: string
}

/**
 * Warmup pool matching: assign warmup partner pairs for the daily batch.
 * Queue: warmup-match
 */
export type WarmupMatchJob = {
  batchDate: string
}

// Union type covering all job payloads — useful for type-safe worker dispatch
export type AnyJob =
  | WarmupSendJob
  | EmailSendJob
  | InboxScanJob
  | AIReplyJob
  | DnsCheckJob
  | RecurringBillingJob
  | DowngradePlanJob
  | InboxScoreJob
  | WarmupMatchJob

// Queue name constants — single source of truth for queue name strings
export const QUEUE_NAMES = {
  WARMUP_SEND: 'warmup-send',
  EMAIL_SEND: 'email-send',
  INBOX_SCAN: 'inbox-scan',
  AI_REPLY: 'ai-reply',
  DNS_CHECK: 'dns-check',
  RECURRING_BILLING: 'recurring-billing',
  DOWNGRADE_PLAN: 'downgrade-plan',
  INBOX_SCORE: 'inbox-score',
  WARMUP_MATCH: 'warmup-match',
} as const

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES]

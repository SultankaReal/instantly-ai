import { Queue } from 'bullmq'
import { redisConnection } from '../lib/redis'

const defaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2000 },
}

export const warmupSendQueue = new Queue('warmup-send', {
  connection: redisConnection,
  defaultJobOptions,
})

export const campaignSendQueue = new Queue('campaign-send', {
  connection: redisConnection,
  defaultJobOptions,
})

export const inboxScanQueue = new Queue('inbox-scan', {
  connection: redisConnection,
  defaultJobOptions,
})

export const aiReplyQueue = new Queue('ai-reply', {
  connection: redisConnection,
  defaultJobOptions,
})

export const recurringBillingQueue = new Queue('recurring-billing', {
  connection: redisConnection,
  defaultJobOptions,
})

export const downgradePlanQueue = new Queue('downgrade-plan', {
  connection: redisConnection,
  defaultJobOptions,
})

export const dnsCheckQueue = new Queue('dns-check', {
  connection: redisConnection,
  defaultJobOptions,
})

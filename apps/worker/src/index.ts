import 'dotenv/config'
import { Worker } from 'bullmq'
import { redisConnection } from './lib/redis'
import { warmupSendProcessor } from './processors/warmup-send.processor'
import { campaignSendProcessor } from './processors/campaign-send.processor'
import { inboxScanProcessor } from './processors/inbox-scan.processor'
import { aiReplyProcessor } from './processors/ai-reply.processor'
import { billingProcessor } from './processors/billing.processor'
import { downgradePlanProcessor } from './processors/downgrade-plan.processor'
import { dnsCheckProcessor } from './processors/dns-check.processor'

const workers = [
  new Worker('warmup-send', warmupSendProcessor, {
    connection: redisConnection,
    concurrency: 10,
  }),
  new Worker('campaign-send', campaignSendProcessor, {
    connection: redisConnection,
    concurrency: 10,
  }),
  new Worker('inbox-scan', inboxScanProcessor, {
    connection: redisConnection,
    concurrency: 5,
  }),
  new Worker('ai-reply', aiReplyProcessor, {
    connection: redisConnection,
    concurrency: 3,
  }),
  new Worker('recurring-billing', billingProcessor, {
    connection: redisConnection,
    concurrency: 2,
  }),
  new Worker('downgrade-plan', downgradePlanProcessor, {
    connection: redisConnection,
    concurrency: 5,
  }),
  new Worker('dns-check', dnsCheckProcessor, {
    connection: redisConnection,
    concurrency: 5,
  }),
]

workers.forEach((w) => {
  w.on('completed', (job) => {
    console.log(`[${w.name}] ${job.id} completed`)
  })
  w.on('failed', (job, err) => {
    console.error(`[${w.name}] ${job?.id} failed:`, err.message)
  })
  w.on('error', (err) => {
    console.error(`[${w.name}] worker error:`, err.message)
  })
})

console.log(
  'Поток worker started. Queues:',
  workers.map((w) => w.name).join(', '),
)

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...')
  await Promise.all(workers.map((w) => w.close()))
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...')
  await Promise.all(workers.map((w) => w.close()))
  process.exit(0)
})

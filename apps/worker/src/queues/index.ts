import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { EmailBatch, ImportJob, ConfirmationEmailJob, DunningEmailJob } from '@inkflow/shared-types';

// ─── Shared retry / backoff config ───────────────────────────────────────────

const DEFAULT_JOB_OPTIONS = {
  attempts: 5,
  backoff: {
    type: 'exponential' as const,
    delay: 1000, // 1s → 2s → 4s → 8s → 16s
  },
} as const;

// ─── Redis connection (shared across all queues) ──────────────────────────────

const REDIS_URL = process.env['REDIS_URL'];
if (!REDIS_URL) {
  throw new Error('REDIS_URL environment variable is required');
}

export const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

// ─── Queue definitions ────────────────────────────────────────────────────────

/**
 * Batch email send queue.
 * Each job processes up to 1 000 recipients via Postmark batch API.
 * Concurrency: 10 workers.
 */
export const emailSendQueue = new Queue<EmailBatch>('email:send-batch', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Welcome email queue.
 * Sends a welcome message to a newly imported or confirmed subscriber.
 * Concurrency: 5 workers.
 */
export const emailWelcomeQueue = new Queue<{ subscriberId: string; publicationId: string }>(
  'email:welcome',
  {
    connection: redisConnection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Transactional email queue.
 * Handles confirmation, dunning, and other one-off transactional emails.
 * Concurrency: 20 workers.
 */
export const emailTransactionalQueue = new Queue<
  ConfirmationEmailJob | DunningEmailJob
>('email:transactional', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Substack import queue.
 * Concurrency: 2 workers (ZIP parsing is CPU-bound).
 */
export const importQueue = new Queue<ImportJob>('import:substack', {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

// ─── Type-safe helper functions ───────────────────────────────────────────────

/**
 * Enqueue a batch of email sends for a given post.
 * The caller is responsible for splitting the recipient list into batches of ≤1 000.
 */
export async function addEmailBatch(data: EmailBatch): Promise<void> {
  const jobId = `email-batch:${data.postId}:${data.batchNumber}`;
  await emailSendQueue.add('send-email-batch', data, {
    jobId, // Deduplication key — safe to retry
  });
}

/**
 * Enqueue a welcome email for a subscriber.
 */
export async function addWelcomeEmail(subscriberId: string, publicationId: string): Promise<void> {
  const jobId = `welcome:${publicationId}:${subscriberId}`;
  await emailWelcomeQueue.add('send-welcome', { subscriberId, publicationId }, { jobId });
}

/**
 * Enqueue a Substack import job.
 */
export async function addImportJob(data: ImportJob): Promise<void> {
  await importQueue.add('import-substack', data);
}

/**
 * email-send.worker.ts
 *
 * BullMQ worker for the `email:send-batch` queue.
 * Implements sendBatchWorker from Pseudocode.md.
 *
 * Idempotency: each job carries a stable jobId (`email-batch:<postId>:<batchNumber>`).
 * BullMQ deduplication + Postmark's idempotent send ensure safe retries.
 */

import { Worker, type Job } from 'bullmq';
import { ServerClient } from '@postmark/sdk';
import type { EmailBatch } from '@inkflow/shared-types';
import IORedis from 'ioredis';
import prisma from '../utils/prisma.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const POSTMARK_API_TOKEN = process.env['POSTMARK_API_TOKEN'];
if (!POSTMARK_API_TOKEN) {
  throw new Error('POSTMARK_API_TOKEN environment variable is required');
}

const POSTMARK_FROM_EMAIL =
  process.env['POSTMARK_FROM_EMAIL'] ?? 'noreply@inkflow.io';

const CONCURRENCY = 10;

// ─── Postmark client ──────────────────────────────────────────────────────────

const postmark = new ServerClient(POSTMARK_API_TOKEN);

// ─── Worker processor ─────────────────────────────────────────────────────────

/**
 * Process a single email batch job.
 *
 * @throws Will rethrow on transient Postmark failures (5xx/timeout) so BullMQ
 *         retries with exponential backoff.
 */
async function processSendBatch(job: Job<EmailBatch>): Promise<void> {
  const { postId, recipients, publicationId } = job.data;

  log('info', 'Processing email batch', {
    jobId: job.id,
    postId,
    publicationId,
    recipientCount: recipients.length,
  });

  // Fetch post details needed for the email payload
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    select: {
      title: true,
      content_html: true,
      publication: {
        select: { name: true },
      },
    },
  });

  const subject = post.title;
  const htmlBody = post.content_html;
  const fromName = post.publication.name;
  const fromEmail = POSTMARK_FROM_EMAIL;

  // Build Postmark message array
  const messages = recipients.map((r) => ({
    From: `${fromName} <${fromEmail}>`,
    To: r.email,
    Subject: subject,
    HtmlBody: htmlBody,
    TrackOpens: true,
    TrackLinks: 'HtmlAndText' as const,
    MessageStream: 'outbound',
    // Tag for Postmark analytics
    Tag: `post-${postId}`,
    Metadata: {
      postId,
      subscriberId: r.id,
      publicationId,
    },
  }));

  // Send via Postmark batch API
  let results: Awaited<ReturnType<typeof postmark.sendEmailBatch>>;
  try {
    results = await postmark.sendEmailBatch(messages);
  } catch (err: unknown) {
    // Network/5xx errors → let BullMQ retry
    log('error', 'Postmark batch API call failed — will retry', {
      jobId: job.id,
      error: String(err),
    });
    throw err;
  }

  // Process individual delivery results
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const recipient = recipients[i];

    if (!result || !recipient) continue;

    if (result.ErrorCode === 0) {
      sent++;
      // Upsert EmailSend record as sent
      await prisma.emailSend.updateMany({
        where: {
          post_id: postId,
          subscriber_id: recipient.id,
        },
        data: {
          status: 'sent',
          postmark_message_id: result.MessageID ?? null,
          sent_at: new Date(),
        },
      });
    } else {
      failed++;
      log('warn', 'Postmark rejected individual message', {
        jobId: job.id,
        subscriberId: recipient.id,
        errorCode: result.ErrorCode,
        message: result.Message,
      });

      await prisma.emailSend.updateMany({
        where: {
          post_id: postId,
          subscriber_id: recipient.id,
        },
        data: {
          status: 'failed',
          failed_at: new Date(),
          error_details: {
            errorCode: result.ErrorCode,
            message: result.Message,
          },
        },
      });

      // Hard bounce (codes 400–499) → mark subscriber as bounced
      if (result.ErrorCode >= 400 && result.ErrorCode < 500) {
        await prisma.subscriber.updateMany({
          where: {
            id: recipient.id,
            publication_id: publicationId,
          },
          data: { status: 'bounced' },
        });
      }
    }
  }

  log('info', 'Email batch complete', {
    jobId: job.id,
    postId,
    processed: recipients.length,
    sent,
    failed,
  });
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function createEmailSendWorker(connection: IORedis): Worker<EmailBatch> {
  const worker = new Worker<EmailBatch>('email:send-batch', processSendBatch, {
    connection,
    concurrency: CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    log('error', 'Email send job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: String(err),
    });
  });

  worker.on('error', (err) => {
    log('error', 'EmailSendWorker encountered an error', { error: String(err) });
  });

  return worker;
}

// ─── Structured logger ────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    worker: 'email-send',
    message,
    ...meta,
  };
  if (process.env['NODE_ENV'] === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    console[level === 'info' ? 'log' : level](JSON.stringify(entry, null, 2));
  }
}

/**
 * email-welcome.worker.ts
 *
 * BullMQ worker for the `email:welcome` queue.
 * Sends a personalised welcome email to a newly confirmed or imported subscriber.
 *
 * Idempotency: jobId is `welcome:<publicationId>:<subscriberId>` — BullMQ
 * deduplication prevents duplicate emails on retry.
 */

import { Worker, type Job } from 'bullmq';
import { ServerClient } from 'postmark';
import IORedis from 'ioredis';
import prisma from '../utils/prisma.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type WelcomeJobData = {
  subscriberId: string;
  publicationId: string;
};

// ─── Configuration ────────────────────────────────────────────────────────────

const POSTMARK_API_TOKEN = process.env['POSTMARK_API_TOKEN'];
if (!POSTMARK_API_TOKEN) {
  throw new Error('POSTMARK_API_TOKEN environment variable is required');
}

const POSTMARK_FROM_EMAIL =
  process.env['POSTMARK_FROM_EMAIL'] ?? 'noreply@inkflow.io';

const CONCURRENCY = 5;

// ─── Postmark client ──────────────────────────────────────────────────────────

const postmark = new ServerClient(POSTMARK_API_TOKEN);

// ─── Processor ───────────────────────────────────────────────────────────────

async function processWelcomeEmail(job: Job<WelcomeJobData>): Promise<void> {
  const { subscriberId, publicationId } = job.data;

  log('info', 'Sending welcome email', { jobId: job.id, subscriberId, publicationId });

  // Fetch subscriber and publication together
  const subscriber = await prisma.subscriber.findUniqueOrThrow({
    where: { id: subscriberId },
    select: { email: true, name: true, status: true },
  });

  const publication = await prisma.publication.findUniqueOrThrow({
    where: { id: publicationId },
    select: {
      name: true,
      slug: true,
      description: true,
      author: { select: { name: true } },
    },
  });

  // Guard: do not send welcome to unsubscribed / bounced subscribers
  if (subscriber.status === 'unsubscribed' || subscriber.status === 'bounced') {
    log('warn', 'Skipping welcome email — subscriber status prevents delivery', {
      subscriberId,
      status: subscriber.status,
    });
    return;
  }

  const greeting = subscriber.name ? `Hi ${subscriber.name},` : 'Hi there,';
  const publicationUrl = `https://inkflow.io/p/${publication.slug}`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:24px;margin-bottom:8px">Welcome to ${escapeHtml(publication.name)}!</h1>
  <p>${escapeHtml(greeting)}</p>
  <p>
    Thanks for subscribing to <strong>${escapeHtml(publication.name)}</strong>
    ${publication.description ? `— ${escapeHtml(publication.description)}` : ''}.
    You'll receive new posts directly in your inbox.
  </p>
  <p>
    <a href="${publicationUrl}" style="color:#3b82f6">Read past issues →</a>
  </p>
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#6b7280">
    You're receiving this because you subscribed to ${escapeHtml(publication.name)}.
    Published by ${escapeHtml(publication.author.name)}.
  </p>
</body>
</html>
  `.trim();

  try {
    await postmark.sendEmail({
      From: `${publication.name} <${POSTMARK_FROM_EMAIL}>`,
      To: subscriber.email,
      Subject: `Welcome to ${publication.name}!`,
      HtmlBody: htmlBody,
      TrackOpens: true,
      TrackLinks: 'None',
      MessageStream: 'outbound',
      Tag: 'welcome',
      Metadata: { subscriberId, publicationId },
    });

    log('info', 'Welcome email sent', { subscriberId, publicationId, to: subscriber.email });
  } catch (err: unknown) {
    log('error', 'Failed to send welcome email — will retry', {
      subscriberId,
      error: String(err),
    });
    throw err;
  }
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function createEmailWelcomeWorker(connection: IORedis): Worker<WelcomeJobData> {
  const worker = new Worker<WelcomeJobData>('email:welcome', processWelcomeEmail, {
    connection,
    concurrency: CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    log('error', 'Welcome email job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: String(err),
    });
  });

  worker.on('error', (err) => {
    log('error', 'EmailWelcomeWorker encountered an error', { error: String(err) });
  });

  return worker;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal HTML escaping for interpolated strings in email templates. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    worker: 'email-welcome',
    message,
    ...meta,
  };
  if (process.env['NODE_ENV'] === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    console[level === 'info' ? 'log' : level](JSON.stringify(entry, null, 2));
  }
}

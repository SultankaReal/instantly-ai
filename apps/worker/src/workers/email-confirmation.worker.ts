/**
 * email-confirmation.worker.ts
 *
 * BullMQ worker for the `email-send` queue.
 * Processes `send-confirmation` jobs: renders and delivers the double opt-in
 * confirmation email to a newly subscribed reader.
 *
 * Idempotency: jobId uses `confirmation:<subscriberId>` pattern — BullMQ
 * deduplication prevents duplicate confirmation emails on retry.
 */

import { Worker, type Job } from 'bullmq';
import { ServerClient } from 'postmark';
import type { ConfirmationEmailJob } from '@inkflow/shared-types';
import { JOB_NAMES } from '@inkflow/shared-types';
import IORedis from 'ioredis';
import prisma from '../utils/prisma.js';

// ─── Configuration ────────────────────────────────────────────────────────────

const POSTMARK_API_TOKEN = process.env['POSTMARK_API_TOKEN'];
if (!POSTMARK_API_TOKEN) {
  throw new Error('POSTMARK_API_TOKEN environment variable is required');
}

const POSTMARK_FROM_EMAIL =
  process.env['POSTMARK_FROM_EMAIL'] ?? 'noreply@inkflow.io';

const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://inkflow.io';

const CONCURRENCY = 10;

// ─── Postmark client ──────────────────────────────────────────────────────────

const postmark = new ServerClient(POSTMARK_API_TOKEN);

// ─── Processor ───────────────────────────────────────────────────────────────

async function processConfirmationEmail(job: Job): Promise<void> {
  // Only handle send-confirmation jobs
  if (job.name !== JOB_NAMES.SEND_CONFIRMATION) return;

  const data = job.data as ConfirmationEmailJob;
  const { subscriberId, publicationId, email, name, confirmationToken } = data;

  log('info', 'Sending confirmation email', {
    jobId: job.id,
    subscriberId,
    publicationId,
    email,
  });

  // Fetch publication + author details
  const publication = await prisma.publication.findUnique({
    where: { id: publicationId },
    select: {
      name: true,
      author: { select: { name: true } },
    },
  });

  if (!publication) {
    log('warn', 'Publication not found — skipping confirmation email', {
      jobId: job.id,
      publicationId,
    });
    return;
  }

  const authorName = publication.author?.name ?? 'the author';
  const confirmationUrl = `${APP_URL}/confirm?token=${encodeURIComponent(confirmationToken)}`;
  const greeting = name ? `Hi ${escapeHtml(name)},` : 'Hi there,';

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm your subscription to ${escapeHtml(publication.name)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f9fc;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:24px 40px">
              <span style="color:#fff;font-size:20px;font-weight:700;line-height:1">${escapeHtml(publication.name)}</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 24px">
              <h1 style="color:#1a1a2e;font-size:26px;font-weight:700;margin:0 0 20px;line-height:1.3">One last step!</h1>
              <p style="color:#444;font-size:16px;line-height:1.6;margin:0 0 16px">${greeting}</p>
              <p style="color:#444;font-size:16px;line-height:1.6;margin:0 0 16px">
                You&apos;re almost subscribed to <strong>${escapeHtml(publication.name)}</strong> by ${escapeHtml(authorName)}.
              </p>
              <p style="color:#444;font-size:16px;line-height:1.6;margin:0 0 32px">
                Please click the button below to confirm your email address and activate your subscription.
              </p>
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="padding:0 0 32px">
                    <a href="${confirmationUrl}" style="background:#6366f1;border-radius:6px;color:#fff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;display:inline-block">
                      Confirm subscription
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color:#444;font-size:16px;line-height:1.6;margin:0 0 8px">Or copy and paste this link:</p>
              <p style="color:#6366f1;font-size:13px;word-break:break-all;margin:0 0 24px">${confirmationUrl}</p>
              <hr style="border:none;border-top:1px solid #e8e8e8;margin:24px 0">
              <p style="color:#888;font-size:13px;line-height:1.5;margin:0">
                This link expires in <strong>48 hours</strong>. If you did not sign up for ${escapeHtml(publication.name)}, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f6f9fc;padding:20px 40px;border-top:1px solid #e8e8e8">
              <p style="color:#aaa;font-size:12px;margin:0;text-align:center">
                Sent by <strong>${escapeHtml(authorName)}</strong> via
                <a href="https://inkflow.io" style="color:#6366f1;text-decoration:none">Inkflow</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    await postmark.sendEmail({
      From: `${publication.name} <${POSTMARK_FROM_EMAIL}>`,
      To: email,
      Subject: `Confirm your subscription to ${publication.name}`,
      HtmlBody: htmlBody,
      TrackOpens: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      TrackLinks: 'None' as any,
      MessageStream: 'outbound',
      Tag: 'confirmation',
      Metadata: { subscriberId, publicationId },
    });

    log('info', 'Confirmation email sent', {
      jobId: job.id,
      subscriberId,
      to: email,
    });
  } catch (err: unknown) {
    log('error', 'Failed to send confirmation email — will retry', {
      jobId: job.id,
      subscriberId,
      error: String(err),
    });
    throw err;
  }
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function createEmailConfirmationWorker(connection: IORedis): Worker {
  const worker = new Worker('email-send', processConfirmationEmail, {
    connection,
    concurrency: CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    log('error', 'Confirmation email job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: String(err),
    });
  });

  worker.on('error', (err) => {
    log('error', 'EmailConfirmationWorker encountered an error', { error: String(err) });
  });

  return worker;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    worker: 'email-confirmation',
    message,
    ...meta,
  };
  if (process.env['NODE_ENV'] === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    console[level === 'info' ? 'log' : level](JSON.stringify(entry, null, 2));
  }
}

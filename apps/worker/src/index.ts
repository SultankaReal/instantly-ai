/**
 * apps/worker/src/index.ts
 *
 * Entry point for the Inkflow BullMQ worker process.
 * Starts all workers and manages graceful shutdown.
 *
 * This process does NOT serve HTTP — it is a background consumer only.
 */

import IORedis from 'ioredis';
import prisma from './utils/prisma.js';
import { createEmailSendWorker } from './workers/email-send.worker.js';
import { createEmailWelcomeWorker } from './workers/email-welcome.worker.js';
import { createImportWorker } from './workers/import.worker.js';

// ─── Required environment variables ──────────────────────────────────────────

const REDIS_URL = process.env['REDIS_URL'];
const DATABASE_URL = process.env['DATABASE_URL'];
const POSTMARK_API_TOKEN = process.env['POSTMARK_API_TOKEN'];

const missing = (
  [
    ['REDIS_URL', REDIS_URL],
    ['DATABASE_URL', DATABASE_URL],
    ['POSTMARK_API_TOKEN', POSTMARK_API_TOKEN],
  ] as [string, string | undefined][]
)
  .filter(([, v]) => !v)
  .map(([k]) => k);

if (missing.length > 0) {
  log('error', 'Missing required environment variables', { missing });
  process.exit(1);
}

// ─── Redis connection ─────────────────────────────────────────────────────────

const redis = new IORedis(REDIS_URL!, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redis.on('error', (err: Error) => {
  log('error', 'Redis connection error', { error: err.message });
});

redis.on('connect', () => {
  log('info', 'Redis connected');
});

// ─── Start workers ────────────────────────────────────────────────────────────

log('info', 'Starting Inkflow workers', {
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  pid: process.pid,
});

const emailSendWorker = createEmailSendWorker(redis);
const emailWelcomeWorker = createEmailWelcomeWorker(redis);
const importWorker = createImportWorker(redis);

log('info', 'All workers started', {
  workers: ['email:send-batch (×10)', 'email:welcome (×5)', 'import:substack (×2)'],
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  log('info', 'Shutdown signal received — draining workers', { signal });

  try {
    // Close workers — waits for in-progress jobs to finish (default 30s timeout)
    await Promise.all([
      emailSendWorker.close(),
      emailWelcomeWorker.close(),
      importWorker.close(),
    ]);

    log('info', 'Workers closed');

    await redis.quit();
    log('info', 'Redis disconnected');

    await prisma.$disconnect();
    log('info', 'Prisma disconnected');

    log('info', 'Graceful shutdown complete');
    process.exit(0);
  } catch (err: unknown) {
    log('error', 'Error during shutdown', { error: String(err) });
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('uncaughtException', (err: Error) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
  void shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason: unknown) => {
  log('error', 'Unhandled promise rejection', { reason: String(reason) });
  // Do NOT exit — BullMQ may have legitimate unhandled rejections during shutdown
});

// ─── Structured logger ────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    service: 'inkflow-worker',
    message,
    ...meta,
  };
  if (process.env['NODE_ENV'] === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    console[level === 'info' ? 'log' : level](JSON.stringify(entry, null, 2));
  }
}

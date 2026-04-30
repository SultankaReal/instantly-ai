/**
 * import.worker.ts
 *
 * BullMQ worker for the `import:substack` queue.
 * Implements parseSubstackExport from Pseudocode.md.
 *
 * Idempotency: Prisma createMany with skipDuplicates:true means re-running
 * the same ZIP only upserts — no duplicate subscribers are created.
 */

import { Worker, type Job, UnrecoverableError } from 'bullmq';
import AdmZip from 'adm-zip';
import { parse as parseCsv } from 'csv-parse/sync';
import fs from 'node:fs';
import path from 'node:path';
import IORedis from 'ioredis';
import type { ImportJob } from '@inkflow/shared-types';
import prisma from '../utils/prisma.js';
import { isValidEmail } from '../utils/email-validator.js';
import { addWelcomeEmail } from '../queues/index.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const CONCURRENCY = 2;
const DB_BATCH_SIZE = 500; // rows per createMany call

// ─── Row shape from Substack CSV ──────────────────────────────────────────────

type SubstackSubscriberRow = {
  email: string;
  type?: string;        // 'paid' | 'free' | 'comp'
  created_at?: string;  // ISO-8601 string or empty
  [key: string]: string | undefined;
};

// ─── Processor ───────────────────────────────────────────────────────────────

async function processImport(job: Job<ImportJob>): Promise<void> {
  const { filePath, publicationId, sendWelcome, initiatedBy } = job.data;

  log('info', 'Starting Substack import', { jobId: job.id, publicationId, filePath, initiatedBy });

  // ── 1. Read ZIP file ──────────────────────────────────────────────────────
  let zip: AdmZip;
  try {
    zip = new AdmZip(filePath);
  } catch (err: unknown) {
    // Corrupt or missing ZIP — do not retry
    throw new UnrecoverableError(
      `Invalid ZIP file at ${filePath}: ${String(err)}`,
    );
  }

  // ── 1b. ZIP bomb protection ───────────────────────────────────────────────
  const MAX_UNCOMPRESSED = 100 * 1024 * 1024; // 100 MB
  const totalUncompressed = zip.getEntries().reduce((sum, e) => sum + e.header.size, 0);
  if (totalUncompressed > MAX_UNCOMPRESSED) {
    throw new UnrecoverableError(
      `ZIP bomb detected — uncompressed size ${totalUncompressed} bytes exceeds 100 MB limit`,
    );
  }

  // ── 2. Locate subscribers.csv inside the archive ──────────────────────────
  const csvEntry = zip.getEntries().find((e) =>
    path.basename(e.entryName).toLowerCase() === 'subscribers.csv',
  );

  if (!csvEntry) {
    throw new UnrecoverableError(
      'subscribers.csv not found inside the ZIP archive. Verify the Substack export format.',
    );
  }

  const csvBuffer = csvEntry.getData();

  // ── 3. Parse CSV ──────────────────────────────────────────────────────────
  let rows: SubstackSubscriberRow[];
  try {
    rows = parseCsv(csvBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as SubstackSubscriberRow[];
  } catch (err: unknown) {
    throw new UnrecoverableError(`Failed to parse subscribers.csv: ${String(err)}`);
  }

  log('info', 'CSV parsed', { jobId: job.id, totalRows: rows.length });

  // ── 4. Validate and transform rows ────────────────────────────────────────
  type SubscriberInsert = {
    publication_id: string;
    email: string;
    status: 'active';
    tier: 'free' | 'paid';
    subscribed_at: Date;
  };

  const validRows: SubscriberInsert[] = [];
  const rowErrors: string[] = [];

  for (const row of rows) {
    const email = (row['email'] ?? '').trim().toLowerCase();

    if (!isValidEmail(email)) {
      rowErrors.push(`Invalid email: "${email}"`);
      continue;
    }

    const tier = row['type']?.toLowerCase() === 'paid' ? 'paid' : 'free';

    let subscribedAt: Date;
    try {
      subscribedAt = row['created_at'] ? new Date(row['created_at']) : new Date();
      if (isNaN(subscribedAt.getTime())) {
        subscribedAt = new Date();
      }
    } catch {
      subscribedAt = new Date();
    }

    validRows.push({
      publication_id: publicationId,
      email,
      status: 'active',
      tier,
      subscribed_at: subscribedAt,
    });
  }

  log('info', 'Rows validated', {
    jobId: job.id,
    valid: validRows.length,
    skipped: rowErrors.length,
  });

  // ── 5. Batch upsert to Postgres ───────────────────────────────────────────
  let imported = 0;

  for (let i = 0; i < validRows.length; i += DB_BATCH_SIZE) {
    const batch = validRows.slice(i, i + DB_BATCH_SIZE);

    const result = await prisma.subscriber.createMany({
      data: batch,
      skipDuplicates: true,
    });

    imported += result.count;

    // Report progress so BullMQ dashboard shows real-time state
    await job.updateProgress(Math.round(((i + batch.length) / validRows.length) * 100));
  }

  log('info', 'DB upsert complete', { jobId: job.id, imported, skipped: validRows.length - imported });

  // ── 6. Optionally enqueue welcome emails ──────────────────────────────────
  if (sendWelcome && imported > 0) {
    // Fetch the IDs of the subscribers we just imported
    const importedSubscribers = await prisma.subscriber.findMany({
      where: {
        publication_id: publicationId,
        email: { in: validRows.map((r) => r.email) },
        status: 'active',
      },
      select: { id: true },
    });

    for (const sub of importedSubscribers) {
      await addWelcomeEmail(sub.id, publicationId);
    }

    log('info', 'Welcome emails enqueued', {
      jobId: job.id,
      count: importedSubscribers.length,
    });
  }

  // ── 7. Clean up temp file ─────────────────────────────────────────────────
  try {
    fs.unlinkSync(filePath);
    log('info', 'Temp file deleted', { filePath });
  } catch (err: unknown) {
    // Non-fatal — temp file can be cleaned up by a cron job later
    log('warn', 'Could not delete temp file', { filePath, error: String(err) });
  }

  // ── 8. Final summary ──────────────────────────────────────────────────────
  const summary = {
    imported,
    failed: rowErrors.length,
    errors: rowErrors.slice(0, 10), // Cap to first 10 errors in output
  };

  log('info', 'Import job finished', { jobId: job.id, ...summary });
}

// ─── Worker factory ───────────────────────────────────────────────────────────

export function createImportWorker(connection: IORedis): Worker<ImportJob> {
  const worker = new Worker<ImportJob>('import:substack', processImport, {
    connection,
    concurrency: CONCURRENCY,
  });

  worker.on('failed', (job, err) => {
    log('error', 'Import job failed', {
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      error: String(err),
    });
  });

  worker.on('error', (err) => {
    log('error', 'ImportWorker encountered an error', { error: String(err) });
  });

  return worker;
}

// ─── Structured logger ────────────────────────────────────────────────────────

function log(level: 'info' | 'warn' | 'error', message: string, meta?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    worker: 'import',
    message,
    ...meta,
  };
  if (process.env['NODE_ENV'] === 'production') {
    process.stdout.write(JSON.stringify(entry) + '\n');
  } else {
    console[level === 'info' ? 'log' : level](JSON.stringify(entry, null, 2));
  }
}

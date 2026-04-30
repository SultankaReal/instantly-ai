import { FastifyInstance } from 'fastify';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { createWriteStream, promises as fsPromises } from 'fs';
import { pipeline } from 'stream/promises';
import { QUEUE_NAMES, JOB_NAMES } from '@inkflow/shared-types';
import type { ImportJob } from '@inkflow/shared-types';

export async function importRoutes(app: FastifyInstance): Promise<void> {
  // Shared queue instance — created once at plugin level, not per-request
  const importQueue = new Queue<ImportJob>(QUEUE_NAMES.IMPORT_SUBSCRIBERS, {
    connection: app.redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  });
  app.addHook('onClose', async () => { await importQueue.close(); });

  // POST /api/publications/:pubId/import/substack — auth required, multipart file upload
  app.post(
    '/api/publications/:pubId/import/substack',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['pubId'],
          properties: { pubId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      const authorId = request.user.sub;
      const { pubId } = request.params as { pubId: string };

      // Verify publication ownership
      const publication = await app.prisma.publication.findUnique({
        where: { id: pubId },
        select: { id: true, author_id: true },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PUBLICATION_NOT_FOUND', message: 'Publication not found' },
        });
      }

      if (publication.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this publication' },
        });
      }

      // Parse multipart: iterate parts to find file and fields
      let sendWelcome = false;
      const tempPath = join(tmpdir(), `inkflow-import-${randomUUID()}.zip`);

      try {
        // @fastify/multipart RequestEntityTooLargeError is thrown automatically
        // when limits are exceeded — catch it below
        const parts = request.parts();

        let fileFound = false;

        for await (const part of parts) {
          if (part.type === 'file' && part.fieldname === 'file') {
            fileFound = true;
            const writeStream = createWriteStream(tempPath);
            await pipeline(part.file, writeStream);
          } else if (part.type === 'field' && part.fieldname === 'sendWelcome') {
            const val = (part as { value: string }).value;
            sendWelcome = val === 'true' || val === '1';
          }
        }

        if (!fileFound) {
          return reply.status(422).send({
            success: false,
            error: { code: 'NO_FILE', message: 'No file uploaded. Send a ZIP file in the "file" field.' },
          });
        }

        // Verify ZIP magic bytes (PK header: 50 4B 03 04)
        const fd = await fsPromises.open(tempPath, 'r');
        const magicBuf = Buffer.alloc(4);
        await fd.read(magicBuf, 0, 4, 0);
        await fd.close();

        const hex = magicBuf.toString('hex');
        if (hex !== '504b0304') {
          await fsPromises.unlink(tempPath).catch(() => undefined);
          return reply.status(422).send({
            success: false,
            error: { code: 'INVALID_FILE_TYPE', message: 'Uploaded file is not a valid ZIP archive.' },
          });
        }

        // Enqueue the import job
        const job = await importQueue.add(
          JOB_NAMES.IMPORT_SUBSTACK,
          {
            publicationId: pubId,
            filePath: tempPath,
            sendWelcome,
            initiatedBy: authorId,
          } satisfies ImportJob,
        );

        return reply.status(202).send({
          success: true,
          data: { jobId: job.id, status: 'queued' },
        });
      } catch (err: unknown) {
        // @fastify/multipart throws RequestEntityTooLargeError on limit breach
        if (
          err instanceof Error &&
          (err.constructor.name === 'RequestEntityTooLargeError' ||
            ('statusCode' in err && (err as { statusCode: number }).statusCode === 413))
        ) {
          // Clean up temp file if it was partially written
          await fsPromises.unlink(tempPath).catch(() => undefined);
          return reply.status(413).send({
            success: false,
            error: { code: 'FILE_TOO_LARGE', message: 'File exceeds the 50 MB upload limit.' },
          });
        }
        throw err;
      }
    },
  );

  // GET /api/publications/:pubId/import/:jobId/status — auth required
  app.get(
    '/api/publications/:pubId/import/:jobId/status',
    {
      preHandler: [app.authenticate],
      schema: {
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['pubId', 'jobId'],
          properties: {
            pubId: { type: 'string', format: 'uuid' },
            jobId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const authorId = request.user.sub;
      const { pubId, jobId } = request.params as { pubId: string; jobId: string };

      // Verify publication ownership
      const publication = await app.prisma.publication.findUnique({
        where: { id: pubId },
        select: { id: true, author_id: true },
      });

      if (!publication) {
        return reply.status(404).send({
          success: false,
          error: { code: 'PUBLICATION_NOT_FOUND', message: 'Publication not found' },
        });
      }

      if (publication.author_id !== authorId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not own this publication' },
        });
      }

      // Fetch job from the queue
      const job = await importQueue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: { code: 'JOB_NOT_FOUND', message: 'Import job not found' },
        });
      }

      // Ensure this job belongs to the specified publication
      if (job.data.publicationId !== pubId) {
        return reply.status(403).send({
          success: false,
          error: { code: 'FORBIDDEN', message: 'This job does not belong to the specified publication' },
        });
      }

      const state = await job.getState();
      const progress = job.progress;

      return reply.send({
        success: true,
        data: {
          jobId: job.id,
          state,
          progress,
          result: job.returnvalue ?? null,
          reason: job.failedReason ?? null,
        },
      });
    },
  );
}

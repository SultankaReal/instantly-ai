// ─── BullMQ Job Data Types ────────────────────────────────────────────────────
// All job payloads must be JSON-serialisable.
// Queue names follow kebab-case convention (see coding-standards rule).

/**
 * A single email recipient within an email batch job.
 */
export type EmailRecipient = {
  /** Subscriber UUID */
  id: string;
  email: string;
  /** Optional display name for personalisation */
  name: string | null;
};

/**
 * Payload for a batch email send job on the `email-send` queue.
 *
 * One post send is split into multiple EmailBatch jobs (1000 recipients each)
 * to stay within Postmark's batch API limits and allow per-batch retries.
 */
export type EmailBatch = {
  postId: string;
  publicationId: string;
  recipients: EmailRecipient[];
  /**
   * Monotonically increasing batch number starting from 1.
   * Used for deduplication and progress tracking.
   */
  batchNumber: number;
  /** Total number of batches for this send — used to detect completion */
  totalBatches: number;
};

/**
 * Payload for a Substack archive import job on the `import-subscribers` queue.
 */
export type ImportJob = {
  publicationId: string;
  /** Absolute path on the worker container filesystem to the uploaded ZIP file */
  filePath: string;
  /** When true, send a welcome email to each successfully imported subscriber */
  sendWelcome: boolean;
  /** UUID of the author who triggered the import */
  initiatedBy: string;
};

/**
 * Payload for a subscription confirmation email job on the `email-send` queue.
 */
export type ConfirmationEmailJob = {
  subscriberId: string;
  publicationId: string;
  email: string;
  name: string | null;
  confirmationToken: string;
};

/**
 * Payload for a dunning (failed payment) email on the `email-send` queue.
 */
export type DunningEmailJob = {
  subscriberId: string;
  publicationId: string;
  email: string;
  name: string | null;
  /** Amount owed in cents */
  amountCents: number;
  /** ISO 4217 currency code, e.g. "usd" */
  currency: string;
  /** Stripe-hosted link for updating payment method */
  retryUrl: string;
  /** Stripe billing portal URL for subscription cancellation */
  cancelUrl: string;
  /** Dunning attempt number, starting from 1. Used to escalate copy. */
  attemptNumber: number;
};

// ─── Queue Names (as const for type safety) ───────────────────────────────────

export const QUEUE_NAMES = {
  EMAIL_SEND: 'email-send',
  IMPORT_SUBSCRIBERS: 'import:substack',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─── Job Name Constants ───────────────────────────────────────────────────────

export const JOB_NAMES = {
  SEND_EMAIL_BATCH: 'send-email-batch',
  SEND_CONFIRMATION: 'send-confirmation',
  SEND_DUNNING: 'send-dunning',
  IMPORT_SUBSTACK: 'import-substack',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];

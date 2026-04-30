import type { Plan } from './models/index.js'

/**
 * Per-plan feature limits.
 * Use Infinity for unlimited — check with Number.isFinite() before enforcing.
 */
export const PLAN_LIMITS: Record<Plan, { accounts: number; campaigns: number }> = {
  trial: { accounts: 1, campaigns: 1 },
  starter: { accounts: 3, campaigns: 5 },
  pro: { accounts: Infinity, campaigns: Infinity },
  agency: { accounts: Infinity, campaigns: Infinity },
} as const

/**
 * Warmup daily send ramp-up schedule.
 * maxDay: inclusive upper bound for days-in-warmup range.
 * min/max: daily email volume range for random selection.
 */
export const WARMUP_RAMP: ReadonlyArray<{ readonly maxDay: number; readonly min: number; readonly max: number }> = [
  { maxDay: 7, min: 5, max: 10 },
  { maxDay: 14, min: 20, max: 40 },
  { maxDay: 21, min: 40, max: 100 },
  { maxDay: 999, min: 100, max: 200 },
] as const

/**
 * Trial period in days (must match users.trial_ends_at logic in auth service).
 */
export const TRIAL_DAYS = 7 as const

/**
 * JWT token TTLs in seconds.
 */
export const JWT_TTL = {
  ACCESS: 15 * 60,       // 15 minutes
  REFRESH: 7 * 24 * 60 * 60, // 7 days
} as const

/**
 * Password reset token TTL in seconds (stored in Redis).
 */
export const RESET_TOKEN_TTL: number = 60 * 60 // 1 hour

/**
 * Rate limiting thresholds (req/min unless noted).
 */
export const RATE_LIMITS = {
  ANONYMOUS_PER_MIN: 100,
  AUTHENTICATED_PER_MIN: 1000,
  AI_GENERATE_PER_HOUR: 10,
  FORGOT_PASSWORD_PER_HOUR: 3,
} as const

/**
 * bcrypt cost factor — never lower than 12.
 */
export const BCRYPT_COST = 12 as const

/**
 * Inbox score colour thresholds (used in frontend and alerts).
 */
export const INBOX_SCORE_THRESHOLDS = {
  RED: 70,    // score < 70 → red
  YELLOW: 85, // 70 ≤ score < 85 → yellow
  // score ≥ 85 → green
} as const

/**
 * Max file size for Substack CSV/ZIP import (in bytes).
 */
export const IMPORT_MAX_FILE_SIZE: number = 50 * 1024 * 1024 // 50 MB

/**
 * BullMQ retry settings used by all queues.
 */
export const QUEUE_DEFAULTS = {
  MAX_ATTEMPTS: 5,
  BACKOFF_TYPE: 'exponential' as const,
  BACKOFF_DELAY: 5000, // ms — first retry after 5s, then doubles
} as const

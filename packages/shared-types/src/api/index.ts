import type { Post, Publication, Subscriber, User } from '../models/index.js';

// ─── Generic wrappers ─────────────────────────────────────────────────────────

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    /** Field-level validation errors (Zod) */
    details?: Record<string, string[]>;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Auth ─────────────────────────────────────────────────────────────────────

/** Returned on successful login or token refresh */
export type AuthResponse = {
  accessToken: string;
  /** Opaque token — store securely, send as Bearer on /auth/refresh */
  refreshToken: string;
  user: Pick<User, 'id' | 'email' | 'name' | 'role'>;
};

export type RefreshTokenResponse = {
  accessToken: string;
  refreshToken: string;
};

// ─── Publication ──────────────────────────────────────────────────────────────

export type PublicationResponse = Omit<Publication, 'stripe_account_id'> & {
  /** Subscriber count visible to the publication owner */
  subscriberCount?: number;
};

export type PublicationListResponse = {
  publications: PublicationResponse[];
  total: number;
};

// ─── Post ─────────────────────────────────────────────────────────────────────

export type PostResponse = Post & {
  publication: Pick<Publication, 'id' | 'name' | 'slug'>;
};

/**
 * Returned by GET /api/posts/:id when the viewer is on the free tier.
 * `content_html` contains only the first 20% of the post body.
 */
export type TruncatedPostResponse = Omit<PostResponse, 'content_html'> & {
  content_html: string;
  /** True when the full content has been truncated server-side */
  truncated: true;
  /** URL of the upgrade / paywall page */
  upgrade_url: string;
};

export type PostListResponse = {
  posts: Array<
    Pick<
      Post,
      | 'id'
      | 'title'
      | 'subtitle'
      | 'slug'
      | 'status'
      | 'access'
      | 'published_at'
      | 'scheduled_at'
      | 'created_at'
    >
  >;
  total: number;
  page: number;
  limit: number;
};

// ─── Subscriber ───────────────────────────────────────────────────────────────

/** Public-facing subscriber record (no tokens) */
export type SubscriberResponse = Omit<
  Subscriber,
  'confirmation_token' | 'confirmation_token_expires_at' | 'stripe_subscription_id' | 'stripe_customer_id'
>;

export type SubscriberListResponse = {
  subscribers: SubscriberResponse[];
  total: number;
  page: number;
  limit: number;
};

// ─── Analytics ───────────────────────────────────────────────────────────────

export type AnalyticsTimeSeriesPoint = {
  /** ISO 8601 date string, granularity depends on range (day/hour) */
  date: string;
  opens: number;
  clicks: number;
};

/** Analytics for a single sent post */
export type PostAnalyticsResponse = {
  postId: string;
  totalRecipients: number;
  delivered: number;
  bounced: number;
  failed: number;
  opens: number;
  /** Unique open count (deduplicated by subscriber_id) */
  uniqueOpens: number;
  clicks: number;
  /** Unique click count (deduplicated by subscriber_id) */
  uniqueClicks: number;
  /** (uniqueOpens / delivered) * 100, rounded to 2 dp */
  openRate: number;
  /** (uniqueClicks / delivered) * 100, rounded to 2 dp */
  clickRate: number;
  timeSeries: AnalyticsTimeSeriesPoint[];
};

/** Aggregate analytics for a publication over a given time window */
export type PublicationAnalyticsResponse = {
  publicationId: string;
  /** ISO 8601 — start of the requested range */
  from: string;
  /** ISO 8601 — end of the requested range */
  to: string;
  totalSubscribers: number;
  activeSubscribers: number;
  paidSubscribers: number;
  newSubscribers: number;
  churned: number;
  /** Net subscriber growth over the period */
  netGrowth: number;
  averageOpenRate: number;
  averageClickRate: number;
  timeSeries: AnalyticsTimeSeriesPoint[];
};

// ─── Stripe / Payments ────────────────────────────────────────────────────────

export type CheckoutSessionResponse = {
  /** Client-side redirect — send browser here to complete payment */
  checkoutUrl: string;
  sessionId: string;
};

export type SubscriptionStatusResponse = {
  active: boolean;
  tier: Subscriber['tier'];
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
};

// ─── Import ───────────────────────────────────────────────────────────────────

export type ImportJobResponse = {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  importedCount?: number;
  skippedCount?: number;
  errorMessage?: string;
};

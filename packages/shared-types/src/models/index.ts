// ─── ENUM Types ──────────────────────────────────────────────────────────────

export type UserRole = 'author' | 'admin';

export type PostStatus = 'draft' | 'scheduled' | 'sent' | 'published';
export type PostAccess = 'free' | 'paid';

export type SubscriberStatus =
  | 'pending_confirmation'
  | 'active'
  | 'unsubscribed'
  | 'bounced'
  | 'spam';

export type SubscriberTier = 'free' | 'paid' | 'trial' | 'past_due';

export type EmailSendStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';

export type EmailEventType = 'open' | 'click' | 'bounce' | 'spam_complaint';

// ─── Entity Interfaces ────────────────────────────────────────────────────────

/**
 * Platform user — newsletter author or admin.
 */
export type User = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  telegram_chat_id: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * A publication owned by one author.
 */
export type Publication = {
  id: string;
  author_id: string;
  name: string;
  slug: string;
  description: string | null;
  custom_domain: string | null;
  logo_url: string | null;
  stripe_account_id: string | null;
  /** Monthly subscription price in cents (e.g. 500 = $5.00) */
  pricing_monthly: number | null;
  /** Annual subscription price in cents */
  pricing_annual: number | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * A newsletter post within a publication.
 */
export type Post = {
  id: string;
  publication_id: string;
  author_id: string;
  title: string;
  subtitle: string | null;
  /** Raw HTML content — always stored after DOMPurify sanitisation */
  content_html: string;
  slug: string;
  status: PostStatus;
  access: PostAccess;
  /** SEO meta description (≤160 chars) */
  meta_description: string | null;
  /** Canonical URL override; null = auto-generated */
  canonical_url: string | null;
  scheduled_at: Date | null;
  sent_at: Date | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * A subscriber of a publication.
 */
export type Subscriber = {
  id: string;
  publication_id: string;
  email: string;
  name: string | null;
  status: SubscriberStatus;
  tier: SubscriberTier;
  /** Double opt-in token (SHA-256 hash) */
  confirmation_token: string | null;
  confirmation_token_expires_at: Date | null;
  confirmed_at: Date | null;
  /** Stripe subscription ID for paid subscribers */
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  subscribed_at: Date;
  unsubscribed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Record of a single email delivery attempt to one recipient.
 */
export type EmailSend = {
  id: string;
  post_id: string;
  subscriber_id: string;
  /** Postmark Message-ID for tracking */
  postmark_message_id: string | null;
  status: EmailSendStatus;
  queued_at: Date;
  sent_at: Date | null;
  delivered_at: Date | null;
  failed_at: Date | null;
  /** JSON payload of the last delivery error from Postmark */
  error_details: Record<string, unknown> | null;
};

/**
 * Engagement event emitted by Postmark webhook.
 */
export type EmailEvent = {
  id: string;
  email_send_id: string;
  event_type: EmailEventType;
  /** For click events — the URL that was clicked */
  link_url: string | null;
  /** Client user-agent string */
  user_agent: string | null;
  occurred_at: Date;
  created_at: Date;
};

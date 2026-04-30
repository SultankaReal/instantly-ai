<<<<<<< HEAD
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
=======
// Request/Response types for all API endpoints

import type {
  Plan,
  AccountStatus,
  CampaignStatus,
  SendStatus,
  LeadStatus,
  ReplyCategory,
  ContactStatus,
  SubscriptionStatus,
  AIReplyMode,
  BillingPeriod,
  InboxScoreProvider,
  AlertType,
} from '../models/index.js'

// ---------- Generic wrappers ----------

export type ApiError = {
  error: string
  message?: string
  details?: unknown
}

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
}

// ---------- Auth ----------

export type RegisterRequest = {
  email: string
  password: string
  fullName?: string
}

export type LoginRequest = {
  email: string
  password: string
}

export type RefreshRequest = {
  refreshToken: string
}

export type LogoutRequest = Record<string, never>

export type ForgotPasswordRequest = {
  email: string
}

export type ResetPasswordRequest = {
  token: string
  newPassword: string
}

export type AuthResponse = {
  accessToken: string
  refreshToken: string
}

export type UserDTO = {
  id: string
  email: string
  fullName: string | null
  plan: Plan
  trialEndsAt: string | null
  aiReplyEnabled: boolean
  aiReplyMode: AIReplyMode
  aiConfidenceThreshold: number
  createdAt: string
}

export type RegisterResponse = {
  user: UserDTO
  accessToken: string
  refreshToken: string
}

// ---------- Email Accounts ----------

export type ConnectAccountRequest = {
  email: string
  password: string
  smtpHost: string
  smtpPort: number
  imapHost: string
  imapPort: number
  displayName?: string
}

/** credentialsEnc is intentionally omitted for security */
export type AccountResponse = {
  id: string
  userId: string
  email: string
  displayName: string | null
  smtpHost: string
  smtpPort: number
  imapHost: string
  imapPort: number
  status: AccountStatus
  inboxScore: number
  dailyLimit: number
  inWarmupPool: boolean
  warmupStartedAt: string | null
  lastScannedAt: string | null
  dnsSpf: boolean | null
  dnsDkim: boolean | null
  dnsDmarc: boolean | null
  dnsCheckedAt: string | null
  renewalAttempts: number
  createdAt: string
}

export type AccountListResponse = {
  accounts: AccountResponse[]
}

export type UpdateAccountRequest = {
  displayName?: string
  dailyLimit?: number
}

export type StartWarmupRequest = {
  confirmRisk?: boolean
}

// ---------- Campaigns ----------

export type CreateCampaignStepRequest = {
  stepNumber: number
  subject: string
  bodyHtml: string
  delayDays: number
}

export type CreateCampaignRequest = {
  name: string
  fromAccountId?: string
  scheduleDays?: string[]
  scheduleStart?: string
  scheduleEnd?: string
  timezone?: string
  dailyLimit?: number
  steps: CreateCampaignStepRequest[]
}

export type UpdateCampaignRequest = {
  name?: string
  fromAccountId?: string
  scheduleDays?: string[]
  scheduleStart?: string
  scheduleEnd?: string
  timezone?: string
  dailyLimit?: number
}

export type CampaignStepResponse = {
  id: string
  campaignId: string
  stepNumber: number
  subject: string
  bodyHtml: string
  delayDays: number
}

export type CampaignResponse = {
  id: string
  userId: string
  name: string
  status: CampaignStatus
  fromAccountId: string | null
  scheduleDays: string[]
  scheduleStart: string
  scheduleEnd: string
  timezone: string
  dailyLimit: number
  steps: CampaignStepResponse[]
  createdAt: string
  updatedAt: string
}

export type CampaignListResponse = {
  campaigns: CampaignResponse[]
}

export type CampaignStatsResponse = {
  campaignId: string
  sent: number
  delivered: number
  opened: number
  replied: number
  bounced: number
  openRate: number
  replyRate: number
  bounceRate: number
}

// ---------- Contacts ----------

export type ContactResponse = {
  id: string
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  company: string | null
  position: string | null
  customVars: Record<string, unknown>
  status: ContactStatus
  createdAt: string
}

export type ImportContactsResponse = {
  imported: number
  skipped: number
  errors: number
}

export type ContactListResponse = PaginatedResponse<ContactResponse>

// ---------- Email Sends ----------

export type EmailSendResponse = {
  id: string
  campaignId: string
  stepId: string
  contactId: string
  accountId: string
  status: SendStatus
  messageId: string | null
  openedAt: string | null
  repliedAt: string | null
  bouncedAt: string | null
  sentAt: string | null
  createdAt: string
}

// ---------- Inbox ----------

export type InboxMessageResponse = {
  id: string
  userId: string
  accountId: string
  sendId: string | null
  fromEmail: string
  fromName: string | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  isRead: boolean
  leadStatus: LeadStatus | null
  aiDraft: string | null
  aiCategory: ReplyCategory | null
  aiConfidence: number | null
  aiSentAt: string | null
  messageId: string | null
  receivedAt: string
}

export type InboxListResponse = PaginatedResponse<InboxMessageResponse>

export type UpdateInboxMessageRequest = {
  isRead?: boolean
  leadStatus?: LeadStatus
}

export type SendManualReplyRequest = {
  body: string
  subject?: string
}

// ---------- Inbox Alerts ----------

export type InboxAlertResponse = {
  id: string
  accountId: string
  alertType: AlertType
  message: string
  isRead: boolean
  createdAt: string
}

// ---------- Inbox Score ----------

export type InboxScoreSnapshotResponse = {
  id: string
  accountId: string
  score: number
  provider: InboxScoreProvider
  snapshottedAt: string
}

// ---------- Billing / Subscriptions ----------

export type CheckoutRequest = {
  plan: 'starter' | 'pro' | 'agency'
  period: 'monthly' | 'yearly'
}

export type CheckoutResponse = {
  paymentUrl: string
}

export type SubscriptionResponse = {
  id: string
  userId: string
  plan: Plan
  status: SubscriptionStatus
  amount: number
  billingPeriod: BillingPeriod
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  cancelledAt: string | null
  renewalAttempts: number
  renewalAttemptAt: string | null
  createdAt: string
}

export type PaymentEventResponse = {
  id: string
  userId: string
  eventType: string
  yookassaEventId: string | null
  amount: number | null
  createdAt: string
}

// ---------- User profile ----------

export type UpdateUserRequest = {
  fullName?: string
  aiReplyEnabled?: boolean
  aiReplyMode?: AIReplyMode
  aiConfidenceThreshold?: number
}
>>>>>>> f4b81c234214e06582b16ab83530a90f466ccb4d

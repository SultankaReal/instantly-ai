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

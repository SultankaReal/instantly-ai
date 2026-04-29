// Zod schemas for API validation — used at ALL API boundaries (Fastify route schemas)

import { z } from 'zod'

// ---------- Auth schemas ----------

export const RegisterSchema = z.object({
  email: z.string().email('Невалидный email адрес'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
  fullName: z.string().min(1).max(255).optional(),
})
export type RegisterSchemaType = z.infer<typeof RegisterSchema>

export const LoginSchema = z.object({
  email: z.string().email('Невалидный email адрес'),
  password: z.string().min(1, 'Пароль обязателен'),
})
export type LoginSchemaType = z.infer<typeof LoginSchema>

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken обязателен'),
})
export type RefreshSchemaType = z.infer<typeof RefreshSchema>

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Невалидный email адрес'),
})
export type ForgotPasswordSchemaType = z.infer<typeof ForgotPasswordSchema>

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token обязателен'),
  newPassword: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
})
export type ResetPasswordSchemaType = z.infer<typeof ResetPasswordSchema>

// ---------- Email Account schemas ----------

export const ConnectAccountSchema = z.object({
  email: z.string().email('Невалидный email адрес'),
  password: z.string().min(1, 'App Password обязателен'),
  smtpHost: z.string().min(1, 'SMTP хост обязателен'),
  smtpPort: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(465),
  imapHost: z.string().min(1, 'IMAP хост обязателен'),
  imapPort: z
    .number()
    .int()
    .min(1)
    .max(65535)
    .default(993),
  displayName: z.string().min(1).max(255).optional(),
})
export type ConnectAccountSchemaType = z.infer<typeof ConnectAccountSchema>

export const UpdateAccountSchema = z.object({
  displayName: z.string().min(1).max(255).optional(),
  dailyLimit: z.number().int().min(1).max(500).optional(),
})
export type UpdateAccountSchemaType = z.infer<typeof UpdateAccountSchema>

export const StartWarmupSchema = z.object({
  confirmRisk: z.boolean().optional(),
})
export type StartWarmupSchemaType = z.infer<typeof StartWarmupSchema>

// ---------- Campaign schemas ----------

export const CampaignStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  subject: z.string().min(1, 'Тема письма обязательна').max(998),
  bodyHtml: z.string().min(1, 'Тело письма обязательно'),
  delayDays: z.number().int().min(0).default(0),
})
export type CampaignStepSchemaType = z.infer<typeof CampaignStepSchema>

const SCHEDULE_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const ScheduleDaySchema = z.enum(SCHEDULE_DAYS)

const TimeStringSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, 'Время должно быть в формате HH:MM')

export const CreateCampaignSchema = z.object({
  name: z.string().min(1, 'Название кампании обязательно').max(255),
  fromAccountId: z.string().uuid('Невалидный UUID аккаунта').optional(),
  scheduleDays: z.array(ScheduleDaySchema).min(1).default(['mon', 'tue', 'wed', 'thu', 'fri']),
  scheduleStart: TimeStringSchema.default('09:00'),
  scheduleEnd: TimeStringSchema.default('18:00'),
  timezone: z.string().min(1).max(100).default('Europe/Moscow'),
  dailyLimit: z.number().int().min(1).max(500).default(50),
  steps: z.array(CampaignStepSchema).min(1, 'Кампания должна содержать хотя бы один шаг'),
})
export type CreateCampaignSchemaType = z.infer<typeof CreateCampaignSchema>

export const UpdateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  fromAccountId: z.string().uuid().nullable().optional(),
  scheduleDays: z.array(ScheduleDaySchema).min(1).optional(),
  scheduleStart: TimeStringSchema.optional(),
  scheduleEnd: TimeStringSchema.optional(),
  timezone: z.string().min(1).max(100).optional(),
  dailyLimit: z.number().int().min(1).max(500).optional(),
})
export type UpdateCampaignSchemaType = z.infer<typeof UpdateCampaignSchema>

// ---------- Contact schemas ----------

export const ImportContactsQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
})
export type ImportContactsQuerySchemaType = z.infer<typeof ImportContactsQuerySchema>

export const ContactListQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  status: z.enum(['active', 'unsubscribed', 'bounced']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type ContactListQuerySchemaType = z.infer<typeof ContactListQuerySchema>

// ---------- Inbox schemas ----------

export const InboxListQuerySchema = z.object({
  accountId: z.string().uuid().optional(),
  isRead: z.coerce.boolean().optional(),
  leadStatus: z.enum(['interested', 'not_interested', 'callback', 'spam']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type InboxListQuerySchemaType = z.infer<typeof InboxListQuerySchema>

export const UpdateInboxMessageSchema = z.object({
  isRead: z.boolean().optional(),
  leadStatus: z.enum(['interested', 'not_interested', 'callback', 'spam']).optional(),
})
export type UpdateInboxMessageSchemaType = z.infer<typeof UpdateInboxMessageSchema>

export const SendManualReplySchema = z.object({
  body: z.string().min(1, 'Текст ответа обязателен'),
  subject: z.string().max(998).optional(),
})
export type SendManualReplySchemaType = z.infer<typeof SendManualReplySchema>

// ---------- Billing schemas ----------

export const CheckoutSchema = z.object({
  plan: z.enum(['starter', 'pro', 'agency']),
  period: z.enum(['monthly', 'yearly']),
})
export type CheckoutSchemaType = z.infer<typeof CheckoutSchema>

// ---------- User profile schemas ----------

export const UpdateUserSchema = z.object({
  fullName: z.string().min(1).max(255).optional(),
  aiReplyEnabled: z.boolean().optional(),
  aiReplyMode: z.enum(['draft', 'autopilot', 'manual']).optional(),
  aiConfidenceThreshold: z.number().int().min(0).max(100).optional(),
})
export type UpdateUserSchemaType = z.infer<typeof UpdateUserSchema>

// ---------- Pagination helper ----------

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationSchemaType = z.infer<typeof PaginationSchema>

// ---------- UUID param helper ----------

export const UUIDParamSchema = z.object({
  id: z.string().uuid('Невалидный UUID'),
})
export type UUIDParamSchemaType = z.infer<typeof UUIDParamSchema>

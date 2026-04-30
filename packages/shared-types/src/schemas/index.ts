import { z } from 'zod';

// ─── Auth Schemas ─────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters'),
});

export type LoginRequest = z.infer<typeof LoginSchema>;

export const RegisterSchema = z
  .object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address')
      .toLowerCase()
      .trim(),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password too long'),
    name: z
      .string({ required_error: 'Name is required' })
      .min(1, 'Name cannot be empty')
      .max(100, 'Name too long')
      .trim(),
    confirmPassword: z.string({ required_error: 'Password confirmation is required' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type RegisterRequest = z.infer<typeof RegisterSchema>;

// ─── Subscriber Schemas ───────────────────────────────────────────────────────

export const SubscribeRequestSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address')
    .toLowerCase()
    .trim()
    .max(254, 'Email address too long'),
  name: z.string().max(100, 'Name too long').trim().optional(),
});

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;

export const ConfirmSubscriptionSchema = z.object({
  token: z
    .string({ required_error: 'Token is required' })
    .min(32, 'Invalid token')
    .max(128, 'Invalid token'),
});

export type ConfirmSubscriptionRequest = z.infer<typeof ConfirmSubscriptionSchema>;

export const UnsubscribeSchema = z.object({
  token: z
    .string({ required_error: 'Token is required' })
    .min(32, 'Invalid token')
    .max(128, 'Invalid token'),
});

export type UnsubscribeRequest = z.infer<typeof UnsubscribeSchema>;

// ─── Post Schemas ─────────────────────────────────────────────────────────────

const PostAccessSchema = z.enum(['free', 'paid']);

export const CreatePostSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(200, 'Title too long'),
  subtitle: z.string().max(300, 'Subtitle too long').trim().optional(),
  /** DOMPurify-sanitised HTML — validated server-side before storage */
  content_html: z
    .string({ required_error: 'Content is required' })
    .min(1, 'Content cannot be empty'),
  access: PostAccessSchema.default('free'),
  meta_description: z
    .string()
    .max(160, 'Meta description must be 160 characters or fewer')
    .trim()
    .optional(),
  scheduled_at: z.coerce
    .date()
    .refine((d) => d > new Date(), { message: 'Scheduled time must be in the future' })
    .optional(),
});

export type CreatePostRequest = z.infer<typeof CreatePostSchema>;

export const UpdatePostSchema = CreatePostSchema.partial().extend({
  status: z.enum(['draft', 'published']).optional(),
});
export type UpdatePostRequest = z.infer<typeof UpdatePostSchema>;

// ─── Send Post Schema ─────────────────────────────────────────────────────────

export const SendPostSchema = z.object({
  postId: z.string({ required_error: 'Post ID is required' }).uuid('Invalid post ID'),
});

export type SendPostRequest = z.infer<typeof SendPostSchema>;

// ─── Publication Schemas ──────────────────────────────────────────────────────

export const CreatePublicationSchema = z.object({
  name: z
    .string({ required_error: 'Publication name is required' })
    .min(1, 'Name cannot be empty')
    .max(100, 'Name too long')
    .trim(),
  slug: z
    .string({ required_error: 'Slug is required' })
    .min(3, 'Slug must be at least 3 characters')
    .max(50, 'Slug too long')
    .regex(/^[a-z0-9-]+$/, 'Slug may only contain lowercase letters, numbers, and hyphens'),
  description: z.string().max(500, 'Description too long').trim().optional(),
  pricing_monthly: z
    .number()
    .int('Pricing must be an integer (cents)')
    .min(100, 'Minimum price is $1.00 (100 cents)')
    .optional(),
  pricing_annual: z
    .number()
    .int('Pricing must be an integer (cents)')
    .min(100, 'Minimum price is $1.00 (100 cents)')
    .optional(),
});

export type CreatePublicationRequest = z.infer<typeof CreatePublicationSchema>;

export const UpdatePublicationSchema = CreatePublicationSchema.partial().extend({
  custom_domain: z
    .string()
    .regex(
      /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
      'Invalid domain name',
    )
    .optional(),
});

export type UpdatePublicationRequest = z.infer<typeof UpdatePublicationSchema>;

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;

// ─── Domain Types ─────────────────────────────────────────────────────────────
// Local copies of the shapes the bot cares about, aligned with shared-types.
// Using type aliases (not imports from shared-types) to keep the bot package
// independent of workspace build order at runtime.

export type Author = {
  id: string;
  email: string;
  name: string;
  telegram_chat_id: string | null;
};

export type Publication = {
  id: string;
  author_id: string;
  name: string;
  slug: string;
  description: string | null;
  custom_domain: string | null;
  pricing_monthly: number | null;
  pricing_annual: number | null;
  created_at: string;
  updated_at: string;
};

export type PostStatus = 'draft' | 'scheduled' | 'sent' | 'published';
export type PostAccess = 'free' | 'paid';

export type Post = {
  id: string;
  publication_id: string;
  author_id: string;
  title: string;
  subtitle: string | null;
  content_html: string;
  slug: string;
  status: PostStatus;
  access: PostAccess;
  meta_description: string | null;
  sent_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreatePostDto = {
  title: string;
  content_html: string;
  access: PostAccess;
  status: PostStatus;
  meta_description?: string;
};

export type SubscriberStats = {
  total_active: number;
  total_free: number;
  total_paid: number;
  new_this_week: number;
  unsubscribed_this_week: number;
};

export type PostAnalytics = {
  post_id: string;
  title: string;
  sent_count: number;
  unique_opens: number;
  unique_clicks: number;
  open_rate: number;
  click_rate: number;
  sent_at: string | null;
};

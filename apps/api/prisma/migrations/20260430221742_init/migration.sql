-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('author', 'admin');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'scheduled', 'sent', 'published');

-- CreateEnum
CREATE TYPE "PostAccess" AS ENUM ('free', 'paid');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('pending_confirmation', 'active', 'unsubscribed', 'bounced', 'spam');

-- CreateEnum
CREATE TYPE "SubscriberTier" AS ENUM ('free', 'paid', 'trial', 'past_due');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('queued', 'sent', 'delivered', 'bounced', 'failed');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('open', 'click', 'bounce', 'spam_complaint');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'author',
    "telegram_chat_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "custom_domain" TEXT,
    "logo_url" TEXT,
    "stripe_account_id" TEXT,
    "pricing_monthly" INTEGER,
    "pricing_annual" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "content_html" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "access" "PostAccess" NOT NULL DEFAULT 'free',
    "meta_description" TEXT,
    "canonical_url" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'pending_confirmation',
    "tier" "SubscriberTier" NOT NULL DEFAULT 'free',
    "confirmation_token" TEXT,
    "confirmation_token_expires_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "stripe_subscription_id" TEXT,
    "stripe_customer_id" TEXT,
    "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "postmark_message_id" TEXT,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'queued',
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "error_details" JSONB,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "email_send_id" TEXT NOT NULL,
    "event_type" "EmailEventType" NOT NULL,
    "link_url" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_logs" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "publication_id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "publications_slug_key" ON "publications"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "publications_custom_domain_key" ON "publications"("custom_domain");

-- CreateIndex
CREATE INDEX "publications_author_id_idx" ON "publications"("author_id");

-- CreateIndex
CREATE INDEX "publications_slug_idx" ON "publications"("slug");

-- CreateIndex
CREATE INDEX "posts_publication_id_idx" ON "posts"("publication_id");

-- CreateIndex
CREATE INDEX "posts_author_id_idx" ON "posts"("author_id");

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_published_at_idx" ON "posts"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "posts_publication_id_slug_key" ON "posts"("publication_id", "slug");

-- CreateIndex
CREATE INDEX "subscribers_publication_id_idx" ON "subscribers"("publication_id");

-- CreateIndex
CREATE INDEX "subscribers_email_idx" ON "subscribers"("email");

-- CreateIndex
CREATE INDEX "subscribers_status_idx" ON "subscribers"("status");

-- CreateIndex
CREATE INDEX "subscribers_confirmation_token_idx" ON "subscribers"("confirmation_token");

-- CreateIndex
CREATE INDEX "subscribers_stripe_customer_id_idx" ON "subscribers"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_publication_id_email_key" ON "subscribers"("publication_id", "email");

-- CreateIndex
CREATE INDEX "email_sends_post_id_idx" ON "email_sends"("post_id");

-- CreateIndex
CREATE INDEX "email_sends_subscriber_id_idx" ON "email_sends"("subscriber_id");

-- CreateIndex
CREATE INDEX "email_sends_status_idx" ON "email_sends"("status");

-- CreateIndex
CREATE INDEX "email_sends_postmark_message_id_idx" ON "email_sends"("postmark_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_post_id_subscriber_id_key" ON "email_sends"("post_id", "subscriber_id");

-- CreateIndex
CREATE INDEX "email_events_email_send_id_idx" ON "email_events"("email_send_id");

-- CreateIndex
CREATE INDEX "email_events_event_type_idx" ON "email_events"("event_type");

-- CreateIndex
CREATE INDEX "email_events_occurred_at_idx" ON "email_events"("occurred_at");

-- CreateIndex
CREATE INDEX "ai_logs_author_id_idx" ON "ai_logs"("author_id");

-- CreateIndex
CREATE INDEX "ai_logs_publication_id_idx" ON "ai_logs"("publication_id");

-- CreateIndex
CREATE INDEX "ai_logs_created_at_idx" ON "ai_logs"("created_at");

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscribers" ADD CONSTRAINT "subscribers_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_email_send_id_fkey" FOREIGN KEY ("email_send_id") REFERENCES "email_sends"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_logs" ADD CONSTRAINT "ai_logs_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

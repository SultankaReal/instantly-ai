---
name: project-context
description: >
  Domain knowledge for Inkflow newsletter platform. Provides context about
  newsletter delivery (Postmark), payments (Stripe/CloudPayments), email queues (BullMQ),
  SEO (Next.js ISR), and the competitive landscape (Substack). Load when working on
  any Inkflow feature to avoid common mistakes and apply correct domain patterns.
version: "1.0"
maturity: production
---

# Inkflow Project Context

## Product Domain: Newsletter Platform

**Core value proposition:** 0% platform commission, native SEO, AI writing assistant.
Authors keep 100% revenue minus Stripe fees (2.9% + $0.30).

**Primary user:** Newsletter authors currently on Substack earning $1K–$10K/month.
**Pain point being solved:** Substack's 10% "success tax" — at $10K/mo, that's $1,000/mo to platform.

## Email Delivery Domain (Postmark)

Key concepts:
- **Message stream:** "outbound" for newsletters, "broadcasts" for transactional
- **Delivery rate target:** ≥98% — track via Postmark dashboard
- **Bounce types:** Hard bounce (permanent, mark subscriber as `bounced`) vs soft bounce (retry)
- **Spam complaints:** Immediately mark subscriber status = `spam`, never retry
- **DMARC/DKIM/SPF:** Required DNS records for deliverability — see Architecture.md Section 5
- **Batch sending:** Postmark API supports up to 500 emails per batch request
- **Open/click tracking:** Postmark injects tracking pixels automatically when enabled

### Common Postmark Mistakes
- Don't use `Message-ID` header — Postmark generates it
- Always use `MessageStream` field or emails go to wrong stream
- Bounce webhooks: check `Type` field — `HardBounce` vs `SpamComplaint` have different handling

## Payments Domain (Stripe)

Key concepts:
- **Connect:** NOT used — authors connect their own Stripe account via OAuth
- **Stripe Checkout:** Redirect-based payment page (not embedded Elements for MVP)
- **Subscription lifecycle:** `incomplete` → `active` → `past_due` → `canceled`
- **Webhook events to handle:** `checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`
- **Idempotency:** Every webhook must check `stripe_event_id` before processing (not yet implemented — known gap)
- **Fee calculation:** Stripe takes 2.9% + $0.30 per transaction; Inkflow takes 0%

### Common Stripe Mistakes
- Never use `event.data.object.metadata` without validating ownership server-side
- Raw body REQUIRED for `constructEvent()` — don't parse JSON first
- Test webhooks with `stripe listen --forward-to localhost:3000/api/stripe/webhook`

## Queue Domain (BullMQ)

Key concepts:
- **Queue names:** `email-send`, `subscriber-import`
- **Job batching:** 1000 subscribers per job (not one job per subscriber)
- **Retry policy:** 5 attempts with exponential backoff (1min, 2min, 4min, 8min, 16min)
- **Bull Board:** Dashboard at `/admin/queues` for monitoring job status
- **Concurrency:** 2 workers for email-send queue (configured in Architecture.md)
- **Throughput:** ~100K emails in ~2 minutes at current config

### Common BullMQ Mistakes
- Jobs MUST be idempotent — BullMQ may run a job multiple times on failure
- Always check if job was already processed before starting (use `message_id` from EmailSend)
- Don't put large data in job payload — store in DB, pass ID

## SEO Domain (Next.js ISR)

Key concepts:
- **ISR:** Incremental Static Regeneration — `revalidate: 300` (5 min) for post pages
- **Canonical URL:** Always points to custom domain when configured
- **Structured data:** `Article` JSON-LD schema on every post page
- **Sitemap:** `sitemap.xml` at publication root — updated on post publish
- **LCP target:** <1.5s — achieved via SSR + Cloudflare CDN + image optimization

### Common SEO Mistakes
- Don't use `<meta name="robots" content="noindex">` on published posts
- Open Graph images: must be absolute URLs (not relative paths)
- `canonical` URL: must be the custom domain version, not inkflow.io subdomain

## Multi-Tenancy

All data is scoped to `publication_id`. Every database query MUST include this filter.

```typescript
// CORRECT
prisma.subscriber.findMany({
  where: { publication_id: req.user.publicationId, status: 'active' }
})

// WRONG — leaks data across publications
prisma.subscriber.findMany({ where: { status: 'active' } })
```

## Competitive Context

| Platform | Commission | SEO | AI |
|---------|-----------|-----|-----|
| **Inkflow** | 0% (flat SaaS) | ✅ Native SSR | ✅ Claude API |
| Substack | 10% revenue | ❌ Poor SSR | ❌ None |
| beehiiv | $42-249/mo | ✅ Good | ❌ None |
| Ghost | $9-199/mo | ✅ Good | ❌ None |
| ConvertKit | 3.5-5% OR $25-599 | ❌ | ❌ |

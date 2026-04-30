# Final Summary: Subscriber Management
**Feature:** F2 | **Date:** 2026-05-01

---

## Overview

Subscriber Management is the foundational feature of Inkflow that enables the full subscription lifecycle: reader finds a publication → subscribes → confirms via email → receives newsletters → can unsubscribe at any time. It is security-critical (double opt-in prevents spam, HMAC tokens prevent unsubscribe forgery) and a prerequisite for all email-sending features (F1, F3, F5).

## Problem & Solution

**Problem:** Readers need a secure, spam-proof way to opt-in to newsletters, with guaranteed ability to opt-out instantly.

**Solution:** Double opt-in with 256-bit random confirmation tokens (48h TTL), HMAC-signed unsubscribe tokens (no PII in URL), and async BullMQ email delivery with 5× retry.

## What's Being Implemented

### Already Exists (no changes needed)
- `apps/api/src/routes/subscribers.ts` — all 4 API endpoints
- `apps/api/src/lib/unsubscribe-token.ts` — HMAC token library
- `packages/email-templates/src/confirmation.tsx` — email template
- `apps/api/prisma/schema.prisma` — Subscriber model with all fields
- `apps/(dashboard)/dashboard/subscribers/page.tsx` — author list page

### Being Fixed
- `subscribers.ts` unsubscribe route — fix to use `verifyUnsubscribeToken` (HMAC) + pubId param

### Being Created
- `apps/worker/src/workers/email-confirmation.worker.ts` — processes `send-confirmation` jobs
- `apps/worker/src/index.ts` — register confirmation worker
- `apps/web/src/app/(public)/p/[slug]/page.tsx` — public publication page with subscribe form
- `apps/web/src/app/(public)/confirm/page.tsx` — confirmation landing page
- `apps/web/src/app/(public)/unsubscribe/page.tsx` — unsubscribe landing page

## Technical Approach

- Architecture: Distributed Monolith (no new services)
- Queue: BullMQ on existing Redis, `email-send` queue, `send-confirmation` job
- Email: React Email template rendered to HTML → Postmark delivery
- Token security: 256-bit random (confirm) + HMAC-SHA256 (unsubscribe)

## Success Metrics

| Metric | Target |
|--------|--------|
| Confirmation email delivery | < 2 min (p99) |
| Unsubscribe effective time | < 60 seconds |
| No duplicate subscribers | 100% |
| Token single-use enforced | 100% |

## Next Steps After This Feature

- F1 Publishing — can now use subscriber lists for email sends
- F6 Substack Import — imports subscribers into the same table

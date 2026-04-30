# Solution Strategy: Subscriber Management
**Feature:** F2 | **Date:** 2026-05-01

---

## SCQA

- **Situation:** Inkflow is a newsletter platform. Authors publish content, readers want to receive it.
- **Complication:** Without a double opt-in subscribe flow, spammers can sign up anyone's email, causing deliverability damage and GDPR liability. Without a reliable unsubscribe mechanism, the platform violates CAN-SPAM/GDPR.
- **Question:** How do we build a secure, idempotent, deliverable subscription flow that handles all re-subscribe and failure scenarios without complexity explosion?
- **Answer:** Double opt-in with 256-bit random tokens (48h TTL), HMAC-signed unsubscribe tokens, async BullMQ email delivery with 5× retry — all built on the existing Prisma schema.

---

## First Principles

1. **An email subscription is a permission slip.** The reader must explicitly consent (double opt-in) before receiving any commercial communication.
2. **Confirmation token is a one-time password.** It must be single-use, time-limited, and high-entropy — same security model as password reset.
3. **Unsubscribe must be frictionless.** CAN-SPAM requires a 10-day opt-out window; we target < 60 seconds. One click, no login required.
4. **Async is mandatory.** Sending an email in the HTTP request path creates latency, blocks the response, and loses retries on transient failures. BullMQ decouples delivery from acceptance.

---

## Root Cause Analysis (why naive implementation fails)

1. Why do subscribers complain about receiving emails after unsubscribing?
   → Unsubscribe was synchronous but the email batch was already queued
2. Why is the batch already queued?
   → Send happens immediately on "Send" click, not checking live status
3. Why doesn't it check live status?
   → The batch processor doesn't re-validate subscriber status at send time
4. Why not?
   → Naive implementation fetches subscribers once upfront
5. **Root cause:** Batch processor must re-check `status = 'active'` at the time of batch execution, not only at enqueue time.

---

## TRIZ Contradictions Resolved

| Contradiction | Tension | TRIZ Principle | Resolution |
|---------------|---------|---------------|------------|
| Security vs UX | Strong token = hard to remember/share | #10 Prior action | Pre-generate token, embed in email link — user never types it |
| Idempotency vs Freshness | Re-subscribe: keep existing data vs generate new token | #35 Parameter change | Upsert updates token only, preserves other fields |
| Delivery speed vs Reliability | Sync = fast but fragile | #25 Self-service | Async queue with built-in retry — API returns 202, delivery guaranteed by worker |

---

## Game Theory Analysis

| Stakeholder | Goal | Nash Equilibrium |
|-------------|------|-----------------|
| Reader | Subscribe and receive content easily; unsubscribe easily | Simple form, reliable confirmation email, one-click unsubscribe |
| Author | High deliverability, no spam reports | Double opt-in prevents invalid emails; unsubscribe prevents spam reports |
| Platform (Inkflow) | High sender reputation | Double opt-in + instant unsubscribe = high domain reputation with Postmark |
| Postmark | Low spam rates | Author interest and platform interest aligned → all parties benefit from double opt-in |

Equilibrium: Double opt-in + instant unsubscribe is the dominant strategy for all parties.

---

## Second-Order Effects

- **Confirmed emails only in lists** → higher open rates → authors feel engaged → authors upgrade to paid plans
- **Instant unsubscribe** → fewer spam reports → better Postmark sender score → higher inbox placement for ALL publications on the platform
- **48h token TTL** → some readers miss the window → lost subscriber → acceptable tradeoff vs security risk of no-expiry tokens

---

## Recommended Approach

1. **Keep the existing API routes** — they are correct and well-structured
2. **Fix the unsubscribe route** — use `verifyUnsubscribeToken` (HMAC) instead of `confirmation_token` lookup
3. **Create `email-confirmation.worker.ts`** — processes `send-confirmation` jobs from the `email-send` queue using React Email `ConfirmationEmail` template
4. **Create three new Next.js pages** — `/p/[slug]` (publication page with subscribe form), `/confirm`, `/unsubscribe`
5. **Wire the confirmation worker into worker `index.ts`**

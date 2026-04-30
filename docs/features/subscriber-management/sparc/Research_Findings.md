# Research Findings: Subscriber Management
**Feature:** F2 | **Date:** 2026-05-01

---

## Executive Summary

Double opt-in is an email industry best practice that reduces invalid emails by ~30% and significantly improves sender reputation. HMAC-signed unsubscribe tokens are the standard approach used by major ESPs (Mailchimp, ConvertKit, Beehiiv). The existing Prisma schema and BullMQ infrastructure are well-suited to implement this without new dependencies.

---

## Key Findings

### Double Opt-In Industry Standards

- **Source:** Postmark documentation [high confidence]
- **Finding:** Postmark recommends double opt-in for all transactional newsletters. Invalid email rates > 2% trigger account review.
- **Implication:** 48h TTL is standard (Mailchimp: 48h, ConvertKit: 72h). Our 48h matches.

### HMAC Token Security

- **Source:** OWASP password reset token guidance [high confidence]
- **Finding:** Tokens should be ≥ 256 bits of entropy, single-use, time-limited. `crypto.randomBytes(32)` produces 256 bits — correct.
- **Finding:** Constant-time comparison is mandatory to prevent timing attacks. Our `verifyUnsubscribeToken` uses XOR comparison — correct.

### BullMQ Queue Name Mismatch (Existing Gap)

- **Source:** Code analysis [high confidence]
- **Finding:** `subscribers.ts` enqueues to `QUEUE_NAMES.EMAIL_SEND = 'email-send'`. The `email-send.worker.ts` listens on `'email:send-batch'` — different queue. Confirmation emails are never consumed.
- **Implication:** **Critical bug.** Must create a worker for the `email-send` queue.

### Unsubscribe Token Implementation Gap

- **Source:** Code analysis [high confidence]
- **Finding:** `subscribers.ts` unsubscribe route looks up `confirmation_token` field — but this is NULL after confirmation. HMAC token lib exists but is not wired into the route.
- **Implication:** Unsubscribe via email link fails for confirmed subscribers. Must fix route to use `verifyUnsubscribeToken`.

### React Email Template Ready

- **Source:** `packages/email-templates/src/confirmation.tsx` [high confidence]
- **Finding:** Fully styled `ConfirmationEmail` component exists. Needs `publicationName`, `confirmationUrl`, `authorName` props.
- **Implication:** Worker can use `render()` from `@react-email/components` to get HTML string.

---

## Confidence Assessment

- **High confidence:** All findings above are from direct code analysis
- **Medium confidence:** Timing for email delivery < 2 min (depends on Postmark SLA and Redis availability)
- **Low confidence:** Bounce handling path for confirmation emails (not tested end-to-end)

---

## Summary of Gaps to Close

| Gap | Severity | Fix |
|-----|----------|-----|
| No confirmation email worker | Critical | Create `email-confirmation.worker.ts` |
| Unsubscribe route uses wrong token field | Critical | Fix to use `verifyUnsubscribeToken` + pubId query param |
| No public subscription page | High | Create `/p/[slug]/page.tsx` |
| No confirm page | High | Create `/confirm/page.tsx` |
| No unsubscribe page | High | Create `/unsubscribe/page.tsx` |

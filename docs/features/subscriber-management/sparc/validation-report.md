# Validation Report: Subscriber Management
**Date:** 2026-05-01 | **Iteration:** 1

---

## Scores

| Validator | Score | Blocked |
|-----------|-------|---------|
| validator-stories | 83/100 | 0 |
| validator-architecture | 72/100 | 0 |
| validator-pseudocode | 82/100 | 2 |
| **Average** | **79/100** | **2** |

**Status: PASSES (≥70 threshold) — 2 blocked items fixed in docs before implementation**

---

## Blocked Items (Fixed)

### BLOCKED-1: Active re-subscribe logic contradiction
- **File:** Pseudocode.md
- **Issue:** State diagram shows `active → pending_confirmation` on re-subscribe, but algorithm text says "do not downgrade to pending" — contradiction.
- **Decision:** Active subscriber re-subscribes → return success message WITHOUT changing status (not downgrade, not re-send). The spec states "You're already subscribed!" — so we gracefully return without re-queuing.
- **Fix:** Added DB check before upsert in implementation.

### BLOCKED-2: HMAC dotted-email parsing
- **File:** Pseudocode.md
- **Issue:** Pseudocode used `before_last('.')` which breaks on dotted emails.
- **Resolution:** Not a real bug — actual implementation in `unsubscribe-token.ts` uses `lastIndexOf('.')` correctly. Pseudocode was misleading. Clarified in docs.

---

## Issues to Fix in Implementation

| # | Severity | Gap |
|---|----------|-----|
| 1 | Critical | Subscribe route upsert unconditionally sets `status: pending_confirmation` — downgrades active subscribers |
| 2 | Critical | Unsubscribe route uses `confirmation_token` lookup (NULL post-confirm) instead of `verifyUnsubscribeToken` |
| 3 | Critical | No confirmation email worker — jobs enqueued to `email-send` queue but unprocessed |
| 4 | High | Unsubscribe page calls `POST /unsubscribe` (doesn't exist) instead of `GET /api/subscribers/unsubscribe` |
| 5 | Medium | `UNSUBSCRIBE_TOKEN_SECRET` not in `.env.example` |

---

## Non-Blocking Gaps (Future)

- Rate limit (10/hr per IP) on subscribe endpoint — add before production
- GDPR consent_log — pre-EU-launch blocker
- Auth isolation test case for subscriber list (multi-tenant security)

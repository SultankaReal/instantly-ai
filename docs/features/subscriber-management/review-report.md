# Review Report: Subscriber Management
**Date:** 2026-05-01 | **Reviewer:** brutal-honesty-review agent

---

## Summary

Overall security posture is solid. No critical vulnerabilities found. Three major issues identified and fixed; minor issues documented.

---

## Issues Found & Fixed

### MAJOR (fixed)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Queue instantiated per request — Redis connection leak under load | Moved `Queue` instantiation to plugin level (once, shared) |
| 2 | Timing oracle on expired token confirm — DB pattern distinguished "exists but expired" from "not found" | Added `confirmation_token_expires_at: { gt: new Date() }` to `where` clause |
| 3 | `UNSUBSCRIBE_TOKEN_SECRET` had insecure default fallback | Changed to throw on startup if env var missing (same pattern as `POSTMARK_API_TOKEN`) |
| 4 | `publication.author.name` nullable — throws if orphaned publication | Added null guard: `publication.author?.name ?? 'the author'` |
| 5 | Confirm page re-called API on refresh → showed error after successful confirm | Redirect to static `/confirmed` page after success; page is refresh-safe |

### MINOR (not fixed — documented)

| # | Issue | Status |
|---|-------|--------|
| 6 | No rate limiting on subscribe endpoint | Pre-existing gap; documented in Refinement.md |
| 7 | Active subscriber can't get new confirmation link | Deliberate (email privacy); "resend" endpoint is v1.0 scope |

---

## What Was Good

- HMAC constant-time comparison in `verifyUnsubscribeToken` — correct
- Single-use token: cleared atomically on confirm — no double-use possible
- Active subscriber not downgraded on re-subscribe — correct
- `escapeHtml` applied to all user data in email HTML — correct
- `Suspense` boundary in unsubscribe page — correct

---

## Test Coverage Gap

No unit tests co-located. Highest-risk uncovered scenarios:
- Expired token confirmation (400 expected)
- Concurrent double-confirm race condition
- Forged unsubscribe HMAC token (400 expected)
- Postmark down during confirmation send (retry expected)

Recommend adding tests before enabling in production.

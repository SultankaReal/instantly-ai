# Refinement: Subscriber Management
**Feature:** F2 | **Date:** 2026-05-01

---

## Edge Cases Matrix

| Scenario | Input | Expected Behavior | Handling |
|----------|-------|-------------------|----------|
| Already active re-subscribe | active email submits form | Re-send confirmation email, no status downgrade | Separate check before upsert |
| Expired token confirm | token > 48h old | 400 TOKEN_EXPIRED with re-subscribe hint | Server checks expires_at |
| Invalid token confirm | random string | 400 INVALID_TOKEN | DB returns null |
| Double-confirm | confirm same token twice | Second request returns 400 (token cleared) | Token nulled on first confirm |
| Unsubscribe then re-subscribe | unsubscribed email submits form | Upsert resets to pending_confirmation with fresh token | Upsert handles all statuses |
| Postmark down | email send fails | BullMQ retries 5× with backoff; subscriber stays pending | Worker throws to trigger retry |
| Concurrent subscribe | same email, same pub, 2 req in flight | DB unique constraint prevents duplicate; one upsert wins | `upsert` with conflict on `(publication_id, email)` |
| Bounced subscriber re-subscribes | bounced email submits form | Reset to pending_confirmation, attempt re-delivery | Upsert clears bounce status |
| Publication deleted | subscribe to deleted pub | 404 PUBLICATION_NOT_FOUND | Route checks pub before upsert |
| Name field missing | email only | Accepted — name is optional | Zod schema: name optional |
| Empty email | empty string | 422 VALIDATION_ERROR | Zod email format validation |

---

## Security Edge Cases

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Token enumeration | Brute-force confirmation tokens | 256-bit entropy makes brute-force infeasible |
| HMAC timing attack on unsubscribe | Infer token validity by response time | `timingSafeEqual` / XOR constant-time in `verifyUnsubscribeToken` |
| Subscriber email enumeration via subscribe | "already subscribed" response exposes subscription | Always return "check inbox" regardless |
| Unsubscribe token reuse across publications | One token could unsubscribe from any pub | Token is bound to publication_id in query param |

---

## Testing Strategy

### Unit Tests

File: `apps/api/src/routes/subscribers.test.ts`

- `subscribe()`: valid email creates pending subscriber
- `subscribe()`: duplicate email upserts with fresh token
- `subscribe()`: active email re-sends confirmation, no downgrade
- `confirmSubscription()`: valid token activates subscriber
- `confirmSubscription()`: expired token returns 400
- `confirmSubscription()`: invalid token returns 400
- `unsubscribe()`: valid HMAC token unsubscribes
- `unsubscribe()`: already unsubscribed returns 200 idempotent
- `unsubscribe()`: invalid token returns 400

File: `apps/api/src/lib/unsubscribe-token.test.ts`

- Round-trip: generate → verify returns original email
- Tampered token raises error
- Timing-safe comparison (no early exit)

### Integration Tests

File: `tests/integration/subscriber-flow.test.ts`

- Full flow: subscribe → confirmation email queued → confirm → active
- Full flow: subscribe → active → email with unsubscribe link → unsubscribe
- Concurrent subscribe (2 requests same email) → single subscriber row

### E2E Tests

File: `tests/e2e/subscriber.spec.ts`

- Playwright: visit `/p/{slug}` → enter email → see success message
- Playwright: visit `/confirm?token=` → see success page
- Playwright: visit `/unsubscribe?token=` → see unsubscribed page

---

## Performance Considerations

- Subscriber upsert: O(1) with composite unique index `(publication_id, email)`
- Token lookup: O(1) with index on `confirmation_token`
- Confirmation email: async via BullMQ — API response is non-blocking
- Subscriber list query: paginated with `LIMIT/OFFSET`, indexed on `publication_id`

---

## Technical Debt Items

| Item | Priority | Notes |
|------|----------|-------|
| GDPR consent_log | Pre-EU-launch blocker | No consent_log table yet |
| Unsubscribe token separate column | Low | Currently reuses HMAC on email; good enough for MVP |
| Rate limiting subscribe endpoint | Medium | Add 10/hr per IP before production |

# PRD: Subscriber Management — Inkflow
**Feature ID:** F2 | **Priority:** 1 (foundational) | **Phase:** MVP
**Date:** 2026-05-01 | **Status:** In development

---

## Executive Summary

Subscriber Management is the foundational feature of Inkflow — it enables readers to subscribe to a newsletter, confirm their email via double opt-in, and unsubscribe at any time. Without this, no emails can be sent (F1 depends on F2). The implementation is security-critical: the confirmation token flow prevents spam sign-ups and GDPR exposure.

## Problem Statement

Authors need a way for readers to opt-in to receive newsletters. The opt-in must be:
1. **Double opt-in** — prevents spam registrations and satisfies GDPR pre-consent
2. **Self-service unsubscribe** — every email must include a one-click unsubscribe link
3. **Idempotent** — re-subscribing or double-clicking confirm must not create duplicates or errors

## Target Users

- **Primary:** Readers who want to subscribe to a newsletter
- **Secondary:** Authors who manage their subscriber list from the dashboard

## Core Features (MVP)

| # | Feature | Priority |
|---|---------|----------|
| 1 | Public subscribe form on publication page | Must Have |
| 2 | Double opt-in confirmation email (48h TTL token) | Must Have |
| 3 | Confirm subscription page (`/confirm?token=`) | Must Have |
| 4 | HMAC-signed unsubscribe links in emails | Must Have |
| 5 | Unsubscribe landing page (`/unsubscribe?token=`) | Must Have |
| 6 | Author subscriber list dashboard (`/dashboard/subscribers`) | Must Have |
| 7 | Re-subscribe handling (idempotent upsert) | Must Have |
| 8 | BullMQ worker for confirmation email delivery | Must Have |

## Out of Scope (MVP)

- Paid subscription tier management (F3)
- Substack CSV import (F6)
- Subscriber segmentation / tags
- Subscriber-facing profile page

## Success Metrics

| Metric | Target |
|--------|--------|
| Confirmation email delivered within | < 2 minutes |
| Unsubscribe effective within | < 60 seconds |
| No duplicate subscribers per publication | 100% |
| Confirmation token single-use enforced | 100% |

## Technical Constraints

- Stack: Fastify API + Next.js 15 App Router + PostgreSQL (Prisma) + BullMQ + Postmark
- Confirmation email template exists in `packages/email-templates/src/confirmation.tsx`
- Subscriber model fully defined in `apps/api/prisma/schema.prisma`
- HMAC unsubscribe token lib exists in `apps/api/src/lib/unsubscribe-token.ts`
- Queue infrastructure: Redis + BullMQ, worker process in `apps/worker`

## Risks

| Risk | Mitigation |
|------|------------|
| GDPR: no consent_log | Pre-launch blocker for EU users (documented in security.md) |
| Token reuse for unsubscribe | Fix: use HMAC-signed unsubscribe token, not confirmation_token |
| Queue name mismatch | `email-send` queue vs `email:send-batch` worker — needs confirmation worker |

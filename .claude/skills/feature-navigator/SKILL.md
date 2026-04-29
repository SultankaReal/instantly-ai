---
name: feature-navigator
description: Roadmap-aware feature navigation for Поток. Reads feature-roadmap.json to suggest next implementation priorities, map PRD user stories to code locations, and track MVP vs v1.0 scope.
version: "1.0"
maturity: production
---

# Feature Navigator — Поток

## MVP Scope (P0-P2)

```
P0 — Must have before any users:
  F01: Auth Module (US-01, US-02, US-03)
  F02: Email Account Management (US-04, US-05, US-06)

P1 — Core product differentiator:
  F03: Warmup Engine (US-06 extended)
  F04: Inbox Score Dashboard (US-07, US-08, US-09)

P2 — Revenue-generating:
  F05: Campaign Engine (US-10, US-11, US-12)
  F07: YooKassa Billing (US-15, US-16, US-17)

P3 — User experience:
  F06: Unified Inbox (US-13, US-14)
  F08: AI Reply Agent (v1.0, feature-gated)
```

## v1.0 Scope (post-MVP)

```
V01: AI Reply Agent full mode
V02: Multi-client Agency Cabinet
V03: amoCRM / Bitrix24 integration
V04: Per-provider Inbox Score (Яндекс vs Mail.ru)
V05: Gmail SMTP/IMAP support
```

## Feature → Code Mapping

| Feature | API Routes | Worker Queues | DB Tables |
|---------|-----------|---------------|-----------|
| Auth | /api/auth/* | — | users |
| Email Accounts | /api/accounts/* | — | email_accounts |
| Warmup | /api/accounts/:id/warmup/* | warmup-send | warmup_events, inbox_score_snapshots |
| Inbox Score | /api/accounts/:id/score/* | — (computed) | inbox_score_snapshots, inbox_alerts |
| Campaigns | /api/campaigns/* | campaign-send | campaigns, contacts, email_sends |
| Inbox | /api/inbox/* | — | inbox_messages |
| Billing | /api/billing/* | recurring-billing, downgrade-plan | subscriptions, payment_events |
| AI Reply | /api/ai/* | ai-reply | inbox_messages (ai_* columns) |

## PRD User Story → Specification Mapping

```
US-01 → Specification.md §1 Auth Module > Registration
US-02 → Specification.md §1 Auth Module > Authentication
US-03 → Specification.md §1 Auth Module > Password Reset
US-04 → Specification.md §2 Email Account Management
US-05 → Specification.md §2 DNS Checker (embedded in US-04)
US-06 → Specification.md §2 Warmup Activation
US-07 → Specification.md §3 Inbox Score
US-08 → Specification.md §3 Score History (embedded in US-07)
US-09 → Specification.md §3 Score Alerts
US-10 → Specification.md §4 Campaign Builder
US-11 → Specification.md §4 CSV Import
US-12 → Specification.md §4 Pause/Resume Campaign
US-13 → Specification.md §5 Unified Inbox
US-14 → Specification.md §5 Lead Status Tags
US-15 → Specification.md §6 YooKassa Billing
US-16 → Specification.md §6 Invoice History
US-17 → Specification.md §6 Cancel Subscription
```

## CAUTION User Stories (from validation-report.md)

These stories have score < 70 and need additional AC before implementation:
- US-09 (score alerts): Telegram channel descoped to MVP — in-platform only
- US-12 (pause/resume): No Gherkin AC for BullMQ state transitions
- US-16 (invoice history): No Gherkin AC, InvoiceDTO not defined
- US-17 (cancel subscription): Re-subscription path not described

Add Gherkin AC before starting these stories.

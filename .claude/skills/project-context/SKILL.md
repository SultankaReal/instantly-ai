---
name: project-context
description: Domain knowledge for Поток — cold email outreach SaaS. Contains Яндекс/Mail.ru SMTP/IMAP specifics, BullMQ warmup patterns, YooKassa payment integration, 38-ФЗ compliance requirements, and Russian B2B email market context.
version: "1.0"
maturity: production
---

# Project Context — Поток

## Domain: Russian Cold Email Outreach

### Market Context
- **Primary providers**: Яндекс.Почта (smtp.yandex.ru:465/587) and Mail.ru (smtp.mail.ru:465/587)
- **Deliverability challenge**: Яндекс/Mail.ru tightened spam filters post Google/Yahoo 2024 DMARC mandate
- **Warmup necessity**: New domains/IPs require 21-day ramp-up to build sender reputation
- **Payment constraint**: Visa/MC blocked in Russia — YooKassa (YooMoney) is the primary gateway
- **Legal requirement**: 38-ФЗ mandates one-click unsubscribe in every commercial email

### Яндекс SMTP/IMAP Configuration
```
SMTP: smtp.yandex.ru, port 465 (SSL) or 587 (STARTTLS)
IMAP: imap.yandex.ru, port 993 (SSL)
Auth: LOGIN (not OAuth2 for app passwords)
Rate limit: ~200 emails/day per account (new), up to 500 (warmed)
Note: Яндекс requires "app password" — not account password
```

### Mail.ru SMTP/IMAP Configuration
```
SMTP: smtp.mail.ru, port 465 (SSL) or 587 (STARTTLS)
IMAP: imap.mail.ru, port 993 (SSL)
Auth: LOGIN with app password
Rate limit: ~100 emails/day per account (new), up to 300 (warmed)
```

### Warmup Ramp-up Schedule (from Pseudocode.md)
```
Days  1-7:  5-10  emails/day  (initial reputation)
Days  8-14: 20-40 emails/day  (moderate warmup)
Days 15-21: 40-100 emails/day (active warmup)
Days 22+:   100-200 emails/day (maintenance)
```

### Inbox Score Formula
```
score = (0.5 × 7d_inbox_rate) + (0.3 × 14d_inbox_rate) + (0.2 × 30d_inbox_rate)
Color: < 70 → red | 70-84 → yellow | ≥ 85 → green
```

### 38-ФЗ Compliance Requirements
- Unsubscribe link MUST appear in every commercial email
- One-click unsubscribe without authentication
- Token: HMAC-SHA256 signed with ENCRYPTION_KEY
- Endpoint: GET /unsubscribe?token=... → 200 "Вы отписаны"
- Idempotent: UNIQUE constraint on email in unsubscribes table

### YooKassa Integration
```
Plans (monthly):
  starter: ₽1,990 (3 accounts, 2 campaigns)
  pro:     ₽4,990 (10 accounts, unlimited campaigns)
  agency:  ₽9,990 (unlimited accounts, multi-client)

Webhook event: payment.succeeded → activate subscription
Webhook event: payment.canceled → mark past_due
Recurring: payment_method_id from first payment used for auto-renewal
HMAC: SHA-256 with Digest header
```

### AI Reply Agent (v1.0)
```
Model: claude-sonnet-4-6
Categories: INTERESTED, QUESTION, NOT_INTERESTED, DO_NOT_CONTACT, OUT_OF_OFFICE
Modes: autopilot (auto-send if confidence ≥ threshold) | draft | manual
Feature flag: user.ai_reply_enabled (default: false, gated in v1.0)
```

### Plan Limits (from Pseudocode.md PLAN_LIMITS)
```
trial:   1 account, 1 campaign, 500 warmup emails
starter: 3 accounts, 2 campaigns, 2000 warmup emails
pro:     10 accounts, unlimited campaigns, 10000 warmup emails
agency:  unlimited accounts, unlimited campaigns, unlimited
```

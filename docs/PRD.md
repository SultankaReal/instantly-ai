# PRD: Inkflow — Newsletter Platform with 0% Commission
**Версия:** 1.0 | **Дата:** 2026-04-23 | **Статус:** Draft

---

## 1. Overview

**Inkflow** — SaaS newsletter-платформа для независимых авторов. Монетизируется через flat subscription fee ($29–149/мес), берёт 0% комиссии с доходов авторов. Ключевые дифференциаторы: нативный SEO (каждый пост — SSR-страница), AI writing assistant, 1-click миграция с Substack.

**One-liner:** "Medium + бизнес-движок для независимых авторов — без налога на успех."

---

## 2. Problem

### Primary Pain (авторы)
При доходе $5,000/мес автор отдаёт Substack $500/мес ($6,000/год) только за право использовать платформу. Эта сумма растёт нелинейно с ростом автора — структурный конфликт интересов.

### Secondary Pains
- **No SEO:** Substack не индексируется нормально в Google → авторы не растут через органику
- **Only subscriptions:** Нет рекламной монетизации, нет цифровых продуктов
- **Bot support:** 2-star rating на Trustpilot, нет живых людей в support
- **Content moderation controversy:** Платформа ассоциируется с extremist content → brand damage

---

## 3. Target Users

### Primary: "Растущий Автор" (Migration Target)
- Нишевый эксперт или ex-журналист зарабатывающий $1K–$10K/мес на Substack
- Платит $1,200–$12,000/год Substack за 10% комиссию
- Боль: при дальнейшем росте комиссия становится невыносимой
- Trigger: Видит калькулятор "сколько ты отдаёшь Substack"

### Secondary: "Новый Автор" (Organic Acquisition)
- Эксперт/консультант 25–50 лет, хочет монетизировать знания
- Ищет "newsletter platform" или "Substack alternative" в Google
- Не имеет существующей рассылки → zero switching cost

### Tertiary: "Медиа-команда"
- Небольшая редакция 2–5 человек, нужен Business tier
- Белая метка, несколько авторов, приоритетный support

---

## 4. Goals & Success Metrics

### Business Goals
| Метрика | M3 | M6 | M12 |
|---------|:--:|:--:|:--:|
| Paying users | 30 | 151 | 460 |
| MRR | $1,950 | $9,815 | $29,900 |
| Gross Margin | 75% | 75% | 75% |
| Break-even | — | — | ✅ M12 |

### Product Goals
| Метрика | Target | Timeline |
|---------|--------|----------|
| Sean Ellis PMF | ≥ 40% "Very disappointed" | M3 |
| D30 Retention (paying) | ≥ 70% | M6 |
| NPS | ≥ 50 | M6 |
| Time to first email | < 10 минут | Launch |
| Email delivery rate | > 98% | Launch |
| Page load (LCP) | < 1.5s | Launch |

---

## 5. Feature Requirements

### MVP Features (v0.1 — Weeks 3–6)

#### F1: Publishing
- Rich text editor (Bold, Italic, Headers, Links, Images, Code blocks)
- Save draft + auto-save (30-second intervals)
- Preview before send
- Schedule send (date + time)
- Publish as: email only / email + public web / web only

#### F2: Subscriber Management
- Email signup form (embeddable + hosted)
- Subscriber list with search/filter
- Import subscribers from CSV / Substack export
- Unsubscribe management (GDPR-compliant)
- Segment: free / paid / trial

#### F3: Paid Subscriptions
- Set price: monthly ($X/мес) + annual ($X/год, custom discount)
- Stripe integration (0% platform fee, Stripe fees pass-through)
- CloudPayments integration (RU market fallback)
- Subscriber access control (free / paid content gates)
- Automatic billing + receipt emails

#### F4: SEO-Native Public Posts
- Every post = SSR Next.js page at `[author-slug].inkflow.io/posts/[slug]`
- Auto-generated: `<title>`, `<meta description>`, Open Graph tags, Twitter Card
- Structured data (Article schema)
- Auto-generated sitemap.xml
- Canonical URLs
- Custom domain support (CNAME)

#### F5: Analytics
- Open rate per email
- Click rate per email
- Subscriber growth chart (30/90/365 days)
- Revenue dashboard (MRR, total, by subscriber)
- Unsubscribe rate

#### F6: Substack Import
- Upload Substack export ZIP → parse subscribers.csv
- Map free/paid subscribers automatically
- Preserve subscriber emails + subscription dates
- Send welcome email after import (optional)

### v1.0 Features (M2–M4)

#### F7: AI Writing Assistant
- "Generate draft" from topic/title → Claude API
- SEO headline optimizer (suggest 5 variants ranked by estimated CTR)
- "Improve this paragraph" inline suggestion
- Best-time-to-send prediction (based on platform engagement data)

#### F8: Cross-publication Recommendations
- Author opt-in to recommendation network
- "Readers of [Author A] also read [Author B]" widget
- Mutual recommendation: Author A recommends B, B recommends A

#### F9: Multi-stream Monetization (Pro)
- **Ad placements:** authors sell sponsored slots, Inkflow takes 15–20%
- **Digital products:** sell PDF guides, templates (Inkflow takes 5%)
- **Tip jar:** one-time payments from readers

#### F10: Podcast/Video (v1)
- RSS feed generation for podcast apps
- Video upload + streaming (via MinIO)
- Embed in email (thumbnail + link) + web (native player)

---

## 6. Pricing

| Tier | Price | Subscribers | Key Features |
|------|-------|:-----------:|-------------|
| **Free** | $0/мес | ≤ 500 | Publishing, email, basic analytics |
| **Launch** | $29/мес | ≤ 5,000 | + Custom domain, advanced analytics, 3 newsletters |
| **Pro** | $79/мес | Unlimited | + AI assistant, multi-stream monetization, recommendations |
| **Business** | $149/мес | Unlimited | + Team (5 members), white-label, priority support, API |

**Platform fee on creator revenue: 0%** (Stripe/CloudPayments fees pass-through)

---

## 7. Non-Functional Requirements

### Performance
- API response time p99 < 200ms
- Email delivery: < 5 minutes from trigger to inbox
- Web page LCP < 1.5s (critical for SEO)
- Uptime SLA: 99.5%

### Security
- HTTPS everywhere (Let's Encrypt)
- DMARC + DKIM + SPF configured from day 1
- Password: bcrypt (cost factor ≥ 12)
- JWT sessions (access 15min + refresh 7d)
- Rate limiting: 100 req/min per IP (anonymous), 1000/min (authenticated)
- Input sanitization: DOMPurify for HTML content

### Scalability
- Horizontal scaling via Docker Compose replicas (stateless API)
- Email queue: BullMQ → handles burst sending
- Database: PostgreSQL connection pooling (PgBouncer)
- CDN: Cloudflare (static assets + DDoS protection)

### GDPR/Compliance
- Subscriber consent logs with timestamps
- Right to deletion: removes subscriber in < 24h
- Data export: subscriber list downloadable by author
- Unsubscribe: one-click, no login required

---

## 8. Out of Scope (MVP)

- Mobile apps (iOS/Android) — web-first, PWA after MVP
- Team collaboration tools — Business tier only (v1)
- Ad marketplace — v1 (after 500 paying users)
- Podcast/Video hosting — v1
- API for third-party integrations — v1

---

## 9. Dependencies & Risks

| Dependency | Risk | Mitigation |
|------------|------|------------|
| Stripe (payments) | Unavailable for RU entity | Non-RU legal entity (Cyprus/UAE) before launch |
| Postmark (email) | Rate limits / bans | Dual provider + Resend fallback |
| Claude API (AI) | Availability / cost | Feature flag; degrade gracefully |
| VPS (AdminVPS/HOSTKEY) | Uptime | Health checks + auto-restart via Docker |

---

## 10. Timeline

| Phase | Scope | Duration |
|-------|-------|----------|
| **Validation** | 20 custdev interviews + landing page | Weeks 1–2 |
| **MVP** | F1–F6 (Publishing, Subscriptions, SEO, Import, Analytics) | Weeks 3–6 |
| **First Users** | Beta → paying users + iteration | Month 2 |
| **PMF** | Sean Ellis test + SEO scale + referral | Month 3 |
| **v1.0** | F7–F9 (AI, Recommendations, Multi-stream) | Month 4–6 |

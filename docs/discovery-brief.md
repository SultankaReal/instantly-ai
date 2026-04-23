# Product Discovery Brief: Inkflow
**Дата:** 2026-04-23 | **Источник:** reverse-engineering-unicorn (DEEP mode, M1-M6)

---

## Product Name (рабочее)
**Inkflow** — newsletter platform с 0% комиссией, нативным SEO и AI writing assistant

## Problem Statement
Substack берёт 10% от дохода авторов — при $5K/мес дохода это $6,000/год «налога на успех». Нет нативного SEO (авторы не растут через Google). Единственный способ монетизации — подписки. Слабая поддержка (боты вместо людей).

## Target Users

### Авторы (Supply Side)
1. **Нишевый эксперт** (45% рынка) — аналитик/консультант 25–50 лет, хочет монетизировать экспертизу
2. **Беглец из медиа** (35%) — ex-журналист, ищет независимость от редакций
3. **Медиа-бизнес** (20%) — небольшие редакции, команды 2–5 человек

### Читатели (Demand Side)
- 50M+ активных подписок на платных рассылках globally
- 25–44 лет, образованные, платёжеспособные
- Мотивация: trust к автору, signal over noise

## Core Value Proposition
**"Пиши, расти, зарабатывай — 0% комиссии, нативный SEO, AI-помощник. Твои подписчики — твои навсегда."**

- One-liner: Medium + бизнес-движок для независимых авторов — без налога на успех

## Key Features (MVP)
1. **Email newsletter publishing** — написать пост → разослать → принять оплату (< 10 минут от регистрации)
2. **Платные подписки** — 0% комиссии (SaaS модель), Stripe/CloudPayments
3. **SEO-native public posts** — каждый пост автоматически SSR-страница с meta tags, structured data
4. **Import from Substack** — 1-click миграция списка подписчиков
5. **Analytics dashboard** — open rates, revenue, subscriber growth

## Key Features (v1.0 — Post-MVP)
- AI writing assistant (черновики, SEO-оптимизация заголовков)
- Cross-publication recommendations (network effect)
- Ad marketplace (15–20% комиссия для Pro-авторов)
- Podcast + Video hosting
- Custom domain

## Technical Context
- **Platform:** Web (primary) + iOS/Android (reading apps)
- **Architecture:** Distributed Monolith (Monorepo)
- **Stack:** Node.js/TypeScript + Next.js + PostgreSQL + Redis
- **Infrastructure:** Docker + Docker Compose на VPS (AdminVPS/HOSTKEY)
- **Email delivery:** Postmark + fallback Resend
- **Payments:** Stripe (через non-RU юрлицо) + CloudPayments (RU fallback)
- **AI Integration:** Claude API через MCP servers
- **Constraints:** Stripe недоступен для RU-юрлица → нужна non-RU entity

## Business Model
- **Free:** $0/мес — до 500 subscribers, базовые фичи
- **Launch:** $29/мес — до 5K subscribers + аналитика + 3 newsletters
- **Pro:** $79/мес — unlimited + AI + multi-stream монетизация
- **Business:** $149/мес — команда + white-label + priority support

## Success Criteria (M6)
- MRR ≥ $9,800 (151 paying users × $65 blended ARPU)
- Sean Ellis PMF ≥ 40%
- D30 retention paying ≥ 70%
- NPS ≥ 50
- Органический трафик ≥ 5,000 визитов/мес

## Market Sizing
- TAM: $1.76B (newsletter platforms, 2025), CAGR 18.2%
- SAM: $880M
- SOM (3 года): $22–44M

## Financial Snapshot
- LTV:CAC = 7.8:1 | Payback = 3.2 мес | Gross Margin = 75%
- Break-even: M12 (460 paying users)
- Нужен Pre-seed $200K к M3

## Verdict
🟢 GO — Overall confidence 0.78

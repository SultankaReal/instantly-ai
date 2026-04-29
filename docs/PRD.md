# Product Requirements Document: Поток

**Версия:** 1.0 | **Дата:** 2026-04-29 | **Статус:** Draft

---

## 1. Обзор продукта

**Поток** — SaaS-платформа для холодного email outreach с прогревом Яндекс/Mail.ru, AI Reply Agent и multi-client агентским режимом. Flat-price. Русскоязычный интерфейс и поддержка. 38-ФЗ compliant.

### One-Liner
> Единственный сервис в России: прогрев Яндекс/Mail.ru + AI Reply Agent + unlimited аккаунты + flat ₽ price.

### Positioning Statement
> Для SDR/Основателей и аутрич-агентств, которым нужен предсказуемый B2B pipeline,
> Поток — это cold email платформа, которая гарантирует попадание в inbox Яндекс/Mail.ru.
> В отличие от Coldy.ai, мы включаем AI Reply Agent, multi-client агентский кабинет
> и flat pricing без per-seat надбавок.

---

## 2. Проблема

### Почему сейчас

| Фактор | Событие | Влияние на рынок |
|--------|---------|-----------------|
| Платежи | Visa/MC заблокированы → Instantly недоступен | Весь RU-рынок ищет альтернативу |
| Deliverability | Google/Yahoo 2024 DMARC → Яндекс/Mail.ru ужесточили фильтры | Warmup стал обязательным |
| AI | Claude/GPT → пользователи ожидают AI-автоматизацию | AI Reply — стандарт ожидания |
| Импортозамещение | Компании ищут RU-аналоги западных SaaS | Готовность платить за локальный продукт |

### Боли сегментов

**Segment A — SDR/Основатель (50%):**
- Тратит 2–4 ч/день на ручные ответы
- Письма падают в спам Яндекс с новых доменов
- Нет времени на настройку сложных инструментов

**Segment B — Аутрич-агентство (30%):**
- Ведёт 7–15 клиентов в разных вкладках браузера
- Нет единого отчётного дашборда для клиентов
- Нет multi-client кабинета ни у одного RU инструмента

**Segment C — B2B SaaS маркетолог (20%):**
- Нет нативной интеграции с amoCRM/Bitrix24
- Нельзя автоматически создавать лиды в CRM из ответов на письма
- Нет предсказуемых метрик для директора по продажам

---

## 3. Решение

### Core Value Proposition
1. **Warmup Яндекс + Mail.ru** — peer SMTP/IMAP network, Inbox Score в реальном времени
2. **AI Reply Agent** — Claude API, 3 режима: Autopilot / Draft / Manual
3. **Unlimited email accounts** — flat price без per-seat надбавок
4. **Multi-client кабинет** — агентский workspace для Agency tier
5. **RU Payments** — YooKassa / СБП / T-Pay

### Aha Moment
> Первое тестовое письмо попало в **inbox Яндекс.Почты** через 10 минут после регистрации.

---

## 4. Целевые сегменты и JTBD

### Segment A: SDR / Основатель стартапа (50%)

| | |
|-|-|
| **Functional Job** | Отправлять 200–500 персонализированных писем/день в Яндекс/Mail.ru без спама |
| **Emotional Job** | Чувствовать контроль над лидогенерацией без SDR-команды |
| **Trigger** | "CTO поставил KPI: нам нужен pipeline" |
| **Success Metric** | ≥5 qualified ответов/неделю на 200 отправленных |

### Segment B: Аутрич-агентство (30%)

| | |
|-|-|
| **Functional Job** | Управлять outreach для 10–50 клиентов из одного кабинета без per-seat pricing |
| **Emotional Job** | Масштабировать без найма SDR-команды |
| **Trigger** | "Клиент просит 50 qualified лидов за месяц" |
| **Success Metric** | Управление 10+ клиентами в одном интерфейсе |

### Segment C: B2B SaaS маркетолог (20%)

| | |
|-|-|
| **Functional Job** | Интегрировать холодные рассылки в CRM-воронку (amoCRM/Bitrix24) |
| **Emotional Job** | Иметь предсказуемый pipeline с дашбордами |
| **Trigger** | "Директор по продажам поставил KPI 100 лидов/мес" |
| **Success Metric** | Автоматическое создание лидов в CRM при ответе |

---

## 5. Feature Matrix

### MVP (M1–M3)

| # | Фича | Сегмент | Priority |
|---|------|---------|:--------:|
| F-01 | Email Account Management (SMTP/IMAP) | A, B, C | P0 |
| F-02 | Warmup Engine (Яндекс + Mail.ru + Gmail) | A, B, C | P0 |
| F-03 | Inbox Score Dashboard | A, B, C | P0 |
| F-04 | Campaign Builder (sequences, scheduling) | A, B, C | P0 |
| F-05 | Contact Management (CSV import, variables) | A, B, C | P0 |
| F-06 | Unified Inbox (входящие по всем аккаунтам) | A, B | P0 |
| F-07 | YooKassa Billing (подписки + СБП) | A, B, C | P0 |
| F-08 | Auth (email + пароль, JWT) | A, B, C | P0 |
| F-09 | DNS Checker (SPF/DKIM/DMARC) | A, B, C | P1 |
| F-10 | Onboarding Wizard (3-шаговый) | A, B, C | P1 |
| F-11 | Analytics (open rate, reply rate, bounce) | A, B, C | P1 |
| F-12 | Unsubscribe (38-ФЗ compliant) | A, B, C | P0 |

### v1.0 (M4–M9)

| # | Фича | Сегмент | Priority |
|---|------|---------|:--------:|
| F-13 | AI Reply Agent (Claude API) | A, B | P0 |
| F-14 | Multi-client Agency Workspace | B | P0 |
| F-15 | amoCRM Integration | C | P1 |
| F-16 | Bitrix24 Integration | C | P1 |
| F-17 | Telegram Notifications | A, B | P1 |
| F-18 | A/B Testing (subject lines, bodies) | A, B, C | P1 |
| F-19 | Blacklist Management | A, B | P2 |
| F-20 | Team Members (sub-accounts) | B, C | P1 |

### v2.0 (M10–M18)

| # | Фича | Сегмент | Priority |
|---|------|---------|:--------:|
| F-21 | AI Contact Database (РФ-специфичная) | A, B, C | P1 |
| F-22 | Telegram Outreach Channel | A, B | P1 |
| F-23 | Public API + Webhooks | B, C | P2 |
| F-24 | Zapier / n8n / Albato Integration | C | P2 |
| F-25 | White-label (для агентств) | B | P2 |

---

## 6. Ценообразование

| Тариф | Цена | Email аккаунтов | AI Reply | Clients | Campaigns/мес |
|-------|:----:|:---------------:|:--------:|:-------:|:------------:|
| **Старт** | ₽1 990/мес | 3 | ❌ | 1 | 5 |
| **Про** | ₽4 990/мес | Unlimited | ✅ Draft | 1 | Unlimited |
| **Агентство** | ₽9 990/мес | Unlimited | ✅ Autopilot | Unlimited | Unlimited |

**Billing:**
- Trial: 7 дней бесплатно (без карты)
- Оплата: ЮКасса / СБП / T-Pay / Банковская карта
- Отмена: в любой момент, доступ до конца периода
- Ежегодная скидка: 20% (₽1 590 / ₽3 990 / ₽7 990)

---

## 7. User Stories (MVP)

### Auth
- **US-01:** Как пользователь, я хочу зарегистрироваться по email + пароль, чтобы получить доступ к платформе.
- **US-02:** Как пользователь, я хочу войти в систему и получить JWT токен, чтобы работать с API.
- **US-03:** Как пользователь, я хочу сбросить пароль по email, чтобы восстановить доступ.

### Email Accounts
- **US-04:** Как пользователь, я хочу подключить Яндекс-аккаунт через SMTP/IMAP, чтобы добавить его в warmup пул.
- **US-05:** Как пользователь, я хочу видеть статус DNS (SPF/DKIM/DMARC) для каждого домена, чтобы знать о проблемах с доставляемостью.
- **US-06:** Как пользователь, я хочу одним кликом запустить прогрев аккаунта, чтобы начать улучшать inbox score.

### Warmup
- **US-07:** Как пользователь, я хочу видеть Inbox Score (0–100%) для каждого аккаунта, обновляющийся каждый час, чтобы отслеживать прогрев.
- **US-08:** Как пользователь, я хочу видеть историю inbox score в виде графика за 30 дней, чтобы понимать динамику.
- **US-09:** Как пользователь, я хочу получать уведомление когда inbox score упал ниже 70%, чтобы реагировать вовремя.

### Campaigns
- **US-10:** Как пользователь, я хочу создать кампанию с последовательностью из 3–5 писем (sequence), чтобы автоматизировать follow-up.
- **US-11:** Как пользователь, я хочу загрузить контакты из CSV с переменными ({{name}}, {{company}}), чтобы персонализировать письма.
- **US-12:** Как пользователь, я хочу поставить кампанию на паузу/возобновить, чтобы управлять отправкой.

### Unified Inbox
- **US-13:** Как пользователь, я хочу видеть все входящие ответы по всем кампаниям в одном месте, чтобы не пропустить лида.
- **US-14:** Как пользователь, я хочу отметить ответ как "Заинтересован / Не заинтересован / Перезвонить", чтобы управлять статусом лидов.

### Billing
- **US-15:** Как пользователь, я хочу оплатить подписку через ЮКасса (карта/СБП), чтобы получить доступ к платным фичам.
- **US-16:** Как пользователь, я хочу посмотреть историю платежей, чтобы скачать чеки.
- **US-17:** Как пользователь, я хочу отменить подписку, чтобы не платить следующий месяц.

---

## 8. Метрики успеха

### Product Metrics (MVP)

| Метрика | Target M3 | Target M6 |
|---------|:---------:|:---------:|
| Time to Aha (первый inbox) | ≤ 10 мин | ≤ 10 мин |
| Onboarding completion rate | ≥ 70% | ≥ 75% |
| Trial → Paid conversion | ≥ 15% | ≥ 20% |
| Monthly Churn | ≤ 5% | ≤ 4% |
| Inbox Rate (Яндекс avg) | ≥ 75% | ≥ 85% |
| NPS | ≥ 30 | ≥ 45 |

### Business Metrics (MVP)

| Метрика | Target M3 | Target M6 |
|---------|:---------:|:---------:|
| Платящих клиентов | 100 | 300 |
| MRR | ₽300K | ₽900K |
| ARPU/мес | ₽3 000 | ₽3 500 |
| CAC (community) | ≤ ₽3 000 | ≤ ₽2 500 |

---

## 9. Timeline

### Phase 1: MVP Launch (M1–M3)

```
M1 (Недели 1–4):
  - Monorepo scaffold (api + web + worker)
  - Auth (JWT), Email Account CRUD
  - Warmup Engine (BullMQ + imapflow)
  - PostgreSQL schema + Prisma migrations

M2 (Недели 5–8):
  - Inbox Score Dashboard (Next.js)
  - Campaign Builder UI
  - CSV Import + персонализация
  - YooKassa Billing

M3 (Недели 9–12):
  - Unified Inbox
  - DNS Checker
  - Beta → 20 пользователей
  - Public Launch (vc.ru + Telegram)
```

### Phase 2: v1.0 (M4–M9)

```
M4–M5: AI Reply Agent (Claude API)
M5–M6: Multi-client Agency Workspace
M7–M8: amoCRM + Bitrix24 Integration
M8–M9: A/B Testing, Telegram Notifications
```

### Phase 3: v2.0 (M10–M18)

```
M10–M12: AI Leads Database (РФ B2B)
M13–M15: Telegram Outreach Channel
M16–M18: Public API + Marketplace Integrations
```

---

## 10. Regulatory Compliance

| Требование | Реализация |
|-----------|-----------|
| 38-ФЗ — кнопка отписки | Обязательная ссылка во всех письмах, 1-кликовая отписка |
| 38-ФЗ — персонализация | Платформа требует переменную {{name}} или иную персонализацию |
| 152-ФЗ — данные в РФ | VPS на серверах РФ (AdminVPS/HOSTKEY) |
| DMARC | DNS Checker показывает статус, блокирует отправку без DMARC |
| Rate limits | Max 200 писем/день для новых аккаунтов (рамп-ап стратегия) |

---

## 11. Out of Scope (MVP)

- LinkedIn / WhatsApp / SMS outreach
- Встроенная B2B база контактов (v2.0)
- White-label (v2.0)
- Mobile приложение
- On-premise / self-hosted версия (enterprise v2.0)
- GDPR compliance (нет EU пользователей в MVP)

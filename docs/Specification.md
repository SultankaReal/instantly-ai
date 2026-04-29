# Specification: Поток

**Версия:** 1.0 | **Дата:** 2026-04-29

---

## 1. User Stories с Acceptance Criteria (Gherkin)

### US-01: Регистрация

**Story:** Как новый пользователь, я хочу зарегистрироваться по email + пароль, чтобы получить доступ к платформе.

```gherkin
Feature: User Registration

  Scenario: Успешная регистрация
    Given я нахожусь на странице /register
    When я ввожу валидный email и пароль ≥8 символов
    And нажимаю "Зарегистрироваться"
    Then создаётся новый аккаунт
    And я получаю JWT access token (15 мин) и refresh token (7 дней)
    And начинается Trial период 7 дней
    And редирект на /onboarding

  Scenario: Дублирующийся email
    Given пользователь с этим email уже существует
    When я пробую зарегистрироваться с тем же email
    Then ответ 409 Conflict
    And сообщение: "Аккаунт с этим email уже существует"

  Scenario: Слабый пароль
    When я ввожу пароль менее 8 символов
    Then ответ 400 Bad Request
    And сообщение: "Пароль должен содержать минимум 8 символов"
```

---

### US-02: Аутентификация

**Story:** Как пользователь, я хочу войти в систему, чтобы работать с платформой.

```gherkin
Feature: Authentication

  Scenario: Успешный вход
    Given пользователь с валидным email и паролем существует
    When я отправляю POST /api/auth/login с корректными данными
    Then ответ 200 с accessToken и refreshToken
    And accessToken expires в 15 мин
    And refreshToken expires в 7 дней

  Scenario: Неверные данные
    When я отправляю неверный пароль
    Then ответ 401 Unauthorized
    And НЕ раскрывается, что именно неверно (email или пароль)

  Scenario: Обновление токена
    Given истёкший accessToken и валидный refreshToken
    When я отправляю POST /api/auth/refresh
    Then ответ 200 с новым accessToken

  Scenario: Logout
    When я отправляю POST /api/auth/logout с валидным токеном
    Then refreshToken добавляется в Redis blacklist
    And повторное использование этого refreshToken → 401
```

---

### US-03: Сброс пароля

**Story:** Как пользователь, я хочу сбросить пароль через email, чтобы восстановить доступ к аккаунту.

```gherkin
Feature: Password Reset

  Scenario: Запрос сброса пароля (success)
    Given пользователь с email user@yandex.ru зарегистрирован
    When я отправляю POST /api/auth/forgot-password с { email: "user@yandex.ru" }
    Then ответ 200 (независимо от того, существует ли email — no enumeration)
    And на email отправляется письмо с HMAC-signed reset token (TTL 1h)
    And токен записывается в Redis с ключом reset:{token}: userId TTL 3600s

  Scenario: Неизвестный email (silent 200)
    When я отправляю POST /api/auth/forgot-password с { email: "unknown@test.com" }
    Then ответ 200 (не раскрываем, существует ли email)
    And письмо НЕ отправляется
    And Redis НЕ создаёт ключ reset:*

  Scenario: Успешный сброс пароля
    Given существует валидный reset token (< 1 часа с момента создания)
    When я отправляю POST /api/auth/reset-password с { token: "...", newPassword: "NewPass123!" }
    Then ответ 200 { success: true }
    And password_hash обновляется (bcrypt cost 12)
    And Redis ключ reset:{token} удаляется (token стал одноразовым)
    And пользователь может войти с новым паролем

  Scenario: Просроченный/использованный токен
    Given reset token просрочен (> 1 часа) или уже использован
    When я отправляю POST /api/auth/reset-password с этим токеном
    Then ответ 400 { error: "token_expired_or_used" }

  Scenario: Rate limit на запрос сброса
    Given пользователь отправил 3 запроса /api/auth/forgot-password за 1 час
    When он отправляет 4-й запрос
    Then ответ 429 Too Many Requests
    And ключ создан НЕ будет
```

**API Contract:**
- `POST /api/auth/forgot-password` — Body: `{ email: string }` → Response 200 (always)
- `POST /api/auth/reset-password` — Body: `{ token: string, newPassword: string }` → Response 200 | 400

---

### US-04: Подключение email аккаунта

**Story:** Как пользователь, я хочу подключить Яндекс-аккаунт через SMTP/IMAP, чтобы добавить его в warmup пул.

```gherkin
Feature: Email Account Connection

  Scenario: Успешное подключение Яндекс аккаунта
    Given я нахожусь на странице /accounts/new
    When я ввожу email@yandex.ru, App Password и нажимаю "Подключить"
    Then система проверяет SMTP (smtp.yandex.com:465) соединение
    And система проверяет IMAP (imap.yandex.com:993) соединение
    And аккаунт сохраняется со статусом "connected"
    And credentials шифруются AES-256 перед сохранением в БД
    And показывается DNS-checker для домена аккаунта

  Scenario: Неверные credentials
    When SMTP/IMAP проверка возвращает ошибку авторизации
    Then аккаунт не сохраняется
    And сообщение: "Проверьте App Password. Убедитесь, что двухфакторная авторизация включена."

  Scenario: Лимит аккаунтов по тарифу
    Given пользователь на тарифе Старт (лимит 3 аккаунта)
    And уже подключено 3 аккаунта
    When пробую добавить 4й аккаунт
    Then ответ 403
    And показывается предложение апгрейда на тариф Про
```

---

### US-06: Запуск прогрева

**Story:** Как пользователь, я хочу одним кликом запустить прогрев аккаунта.

```gherkin
Feature: Warmup Start

  Scenario: Первый запуск прогрева
    Given аккаунт подключён со статусом "connected"
    And DNS настройки корректны (SPF + DKIM + DMARC валидны)
    When я нажимаю "Запустить прогрев"
    Then аккаунт добавляется в warmup пул
    And создаётся первое warmup задание в BullMQ
    And в течение 2–5 мин первое письмо отправлено/получено
    And Inbox Score начинает обновляться (старт: 0%)
    And показывается уведомление "Прогрев запущен ✓"

  Scenario: Запуск без DNS настройки
    Given аккаунт без DMARC записи
    When я пробую запустить прогрев
    Then показывается предупреждение с инструкцией по настройке DMARC
    And кнопка "Запустить" доступна с подтверждением риска

  Scenario: Остановка прогрева
    Given аккаунт в статусе "warming"
    When я нажимаю "Остановить прогрев"
    Then BullMQ jobs для этого аккаунта помечаются как paused
    And аккаунт переходит в статус "paused"
```

---

### US-07: Inbox Score Dashboard

**Story:** Как пользователь, я хочу видеть Inbox Score для каждого аккаунта, обновляющийся каждый час.

```gherkin
Feature: Inbox Score

  Scenario: Отображение Inbox Score
    Given аккаунт в статусе "warming" с историей warmup за 3 дня
    When я открываю Dashboard
    Then вижу Inbox Score в процентах (0–100%) для каждого аккаунта
    And Score обновлялся не более 1 часа назад
    And цветовая индикация: <70% красный, 70–84% жёлтый, 85%+ зелёный

  Scenario: История Score (график)
    When я нажимаю на аккаунт в Dashboard
    Then вижу линейный график Inbox Score за последние 30 дней
    And на графике отмечены даты запуска кампаний

  Scenario: Score падает ниже 70%
    Given аккаунт с Inbox Score 85%
    When Score падает до 65%
    Then создаётся уведомление в Unified Inbox
    And (опционально v1) Telegram-уведомление
```

---

### US-10: Campaign Builder

**Story:** Как пользователь, я хочу создать кампанию с sequence из 3–5 писем.

```gherkin
Feature: Campaign Builder

  Scenario: Создание кампании с sequence
    Given я авторизован и нахожусь на /campaigns/new
    When я создаю кампанию с:
      - Шаг 1: Тема "{{name}}, есть вопрос" + тело письма
      - Шаг 2: Follow-up через 3 дня (если нет ответа)
      - Шаг 3: Последний follow-up через 7 дней
    And прикрепляю email аккаунт-отправитель
    And устанавливаю расписание: Пн–Пт 9:00–18:00 МСК
    Then кампания сохраняется со статусом "draft"
    And preview показывает персонализированное письмо с подставленными переменными

  Scenario: Отправка кампании
    Given кампания в статусе "draft" с 50 контактами
    When я нажимаю "Запустить кампанию"
    Then кампания переходит в статус "running"
    And письма отправляются в пределах расписания (Пн–Пт 9:00–18:00)
    And соблюдается rate limit: ≤200 писем/день с нового аккаунта
    And при получении ответа — автоматически останавливается sequence для этого контакта

  Scenario: Персонализация переменных
    Given CSV с колонками: email, name, company, position
    When я загружаю CSV и создаю шаблон с {{name}}, {{company}}
    Then система валидирует: все переменные в шаблоне присутствуют в CSV
    And строки с пустыми значениями переменных — предупреждение, НЕ блокировка
```

---

### US-11: CSV Import контактов

**Story:** Как пользователь, я хочу загрузить контакты из CSV с переменными.

```gherkin
Feature: Contact Import

  Scenario: Успешный импорт CSV
    Given CSV файл с колонками: email, first_name, company (UTF-8, до 10MB)
    When я загружаю файл на /contacts/import
    Then система валидирует формат email для каждой строки
    And дубликаты (по email) выделяются — пользователь решает: пропустить/обновить
    And импорт завершён: показывает "Импортировано X, пропущено Y, ошибок Z"

  Scenario: Невалидный CSV
    When CSV содержит строки без колонки email
    Then ответ 400 с детальным списком проблемных строк (первые 10)

  Scenario: Unsubscribed контакт
    Given контакт в global unsubscribe списке
    When я пытаюсь добавить его в кампанию
    Then контакт автоматически исключается из отправки
    And статус контакта: "unsubscribed — не будет получать письма"
```

---

### US-13: Unified Inbox

**Story:** Как пользователь, я хочу видеть все входящие ответы в одном месте.

```gherkin
Feature: Unified Inbox

  Scenario: Просмотр входящих
    Given кампания с 3 ответами от разных контактов
    When я открываю /inbox
    Then все ответы сгруппированы по контакту (threading)
    And вижу: имя контакта, компания, название кампании, время ответа
    And письма помечены: Новый / Прочитан / Заинтересован / Не заинтересован

  Scenario: Ручной ответ
    When я открываю диалог и нажимаю "Ответить"
    Then отправка происходит с того email аккаунта, который вёл переписку
    And ответ добавляется в тред

  Scenario: Статус лида
    When я устанавливаю статус "Заинтересован"
    Then контакт перемещается в раздел "Hot Leads"
    And (v1) автоматически создаётся лид в amoCRM (если интеграция подключена)
```

---

### US-15: Оплата подписки

**Story:** Как пользователь, я хочу оплатить подписку через ЮКасса.

```gherkin
Feature: YooKassa Billing

  Scenario: Первая оплата
    Given пользователь на Trial
    When я выбираю тариф "Про" и нажимаю "Оплатить"
    Then создаётся payment в YooKassa API
    And redirect на страницу оплаты ЮКасса
    And после успешной оплаты — webhook payment.succeeded
    And подписка активируется, trial сбрасывается

  Scenario: Рекуррентная оплата
    Given активная подписка с save_payment_method: true
    When наступает дата renewal
    Then автоматически создаётся payment с сохранённым методом
    And при неуспехе — 3 retry с интервалом 24ч, потом downgrade на Free

  Scenario: Отмена подписки
    When я нажимаю "Отменить подписку"
    Then подписка помечается cancelled_at = now()
    And доступ сохраняется до конца оплаченного периода
    And письмо-подтверждение с датой окончания
```

---

## 2. Data Model

### Core Tables

```sql
-- Пользователи
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,         -- bcrypt cost 12
  full_name     TEXT,
  plan          TEXT NOT NULL DEFAULT 'trial',  -- trial|free|starter|pro|agency
  trial_ends_at TIMESTAMPTZ,
  ai_reply_enabled        BOOLEAN NOT NULL DEFAULT FALSE,
  ai_reply_mode           TEXT NOT NULL DEFAULT 'draft', -- draft|autopilot|manual
  ai_confidence_threshold INT NOT NULL DEFAULT 80,       -- 0-100, только для autopilot
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email аккаунты
CREATE TABLE email_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  smtp_host       TEXT NOT NULL,
  smtp_port       INT NOT NULL DEFAULT 465,
  imap_host       TEXT NOT NULL,
  imap_port       INT NOT NULL DEFAULT 993,
  credentials_enc BYTEA NOT NULL,       -- AES-256-GCM зашифрованные credentials
  status          TEXT NOT NULL DEFAULT 'connected', -- connected|warming|paused|error
  inbox_score     INT DEFAULT 0,        -- 0-100
  daily_limit     INT NOT NULL DEFAULT 50,
  in_warmup_pool  BOOLEAN DEFAULT FALSE,
  warmup_started_at TIMESTAMPTZ,        -- когда запущен прогрев (для расчёта daysInWarmup)
  last_scanned_at   TIMESTAMPTZ,        -- последнее IMAP сканирование входящих
  dns_spf         BOOLEAN,              -- SPF запись настроена
  dns_dkim        BOOLEAN,              -- DKIM запись настроена
  dns_dmarc       BOOLEAN,              -- DMARC запись настроена
  dns_checked_at  TIMESTAMPTZ,          -- последняя проверка DNS
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Warmup история
CREATE TABLE warmup_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,        -- sent|received|moved_from_spam|opened
  partner_account TEXT,                 -- email партнёра в пуле
  inbox_score_at  INT,                  -- Inbox Score в момент события
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warmup_events_account_created ON warmup_events(account_id, created_at DESC);

-- Inbox Score история (daily snapshot)
CREATE TABLE inbox_score_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  score       INT NOT NULL,
  provider    TEXT NOT NULL DEFAULT 'combined', -- yandex|mailru|gmail|combined
  snapshotted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_score_snapshots_account_date ON inbox_score_snapshots(account_id, snapshotted_at DESC);

-- Кампании
CREATE TABLE campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft', -- draft|running|paused|completed
  from_account_id UUID REFERENCES email_accounts(id),
  schedule_days   TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  schedule_start  TIME DEFAULT '09:00',
  schedule_end    TIME DEFAULT '18:00',
  timezone        TEXT DEFAULT 'Europe/Moscow',
  daily_limit     INT DEFAULT 50,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Шаги кампании (sequence)
CREATE TABLE campaign_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number  INT NOT NULL,
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,          -- DOMPurify sanitized
  delay_days   INT NOT NULL DEFAULT 0, -- задержка от предыдущего шага
  UNIQUE (campaign_id, step_number)
);

-- Контакты
CREATE TABLE contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  first_name   TEXT,
  last_name    TEXT,
  company      TEXT,
  position     TEXT,
  custom_vars  JSONB DEFAULT '{}',     -- любые кастомные переменные
  status       TEXT DEFAULT 'active',  -- active|unsubscribed|bounced
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

-- Глобальный unsubscribe список
CREATE TABLE unsubscribes (
  email         TEXT PRIMARY KEY,
  unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason        TEXT                   -- manual|bounce|spam_complaint
);

-- Отправки (tracking)
CREATE TABLE email_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id),
  step_id       UUID NOT NULL REFERENCES campaign_steps(id),
  contact_id    UUID NOT NULL REFERENCES contacts(id),
  account_id    UUID NOT NULL REFERENCES email_accounts(id),
  status        TEXT NOT NULL DEFAULT 'queued', -- queued|sent|delivered|opened|replied|bounced|skipped|cancelled
  message_id    TEXT,                  -- SMTP Message-ID для tracking
  opened_at     TIMESTAMPTZ,
  replied_at    TIMESTAMPTZ,
  bounced_at    TIMESTAMPTZ,
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_sends_campaign ON email_sends(campaign_id, status);
CREATE INDEX idx_email_sends_contact ON email_sends(contact_id);

-- Входящие письма (Unified Inbox)
CREATE TABLE inbox_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id      UUID NOT NULL REFERENCES email_accounts(id),
  send_id         UUID REFERENCES email_sends(id),  -- связь с исходным письмом
  from_email      TEXT NOT NULL,
  from_name       TEXT,
  subject         TEXT,
  body_text       TEXT,
  body_html       TEXT,               -- НЕ DOMPurify здесь — rendering в iframe
  is_read         BOOLEAN DEFAULT FALSE,
  lead_status     TEXT,               -- interested|not_interested|callback|spam
  ai_draft        TEXT,               -- черновик AI Reply Agent
  ai_category     TEXT,               -- INTERESTED|NOT_INTERESTED|OUT_OF_OFFICE|QUESTION|DO_NOT_CONTACT
  ai_confidence   INT,                -- 0-100, уверенность модели
  ai_sent_at      TIMESTAMPTZ,        -- когда AI отправил ответ в режиме autopilot
  received_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbox_user_read ON inbox_messages(user_id, is_read, received_at DESC);

-- Подписки/Billing
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  plan                  TEXT NOT NULL,    -- starter|pro|agency
  status                TEXT NOT NULL,    -- active|cancelled|past_due
  yookassa_payment_id   TEXT,
  yookassa_payment_method_id TEXT,        -- для рекуррентных платежей
  amount                INT NOT NULL,     -- в копейках
  billing_period        TEXT DEFAULT 'monthly', -- monthly|annual
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  renewal_attempts      INT NOT NULL DEFAULT 0,    -- счётчик неудачных попыток renewal
  renewal_attempt_at    TIMESTAMPTZ,               -- время последней попытки
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Платёжные события (audit log)
CREATE TABLE payment_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id),
  event_type   TEXT NOT NULL,           -- payment.succeeded|payment.canceled|refund.succeeded
  yookassa_event_id TEXT UNIQUE,        -- для идемпотентности
  amount       INT,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 3. API Contracts

### Auth

```
POST /api/auth/register
  Body: { email: string, password: string, full_name?: string }
  Response 201: { user: UserDTO, accessToken: string, refreshToken: string }
  Response 400: { error: "validation_error", details: [...] }
  Response 409: { error: "email_taken" }

POST /api/auth/login
  Body: { email: string, password: string }
  Response 200: { accessToken: string, refreshToken: string }
  Response 401: { error: "invalid_credentials" }

POST /api/auth/refresh
  Body: { refreshToken: string }
  Response 200: { accessToken: string }
  Response 401: { error: "token_invalid_or_expired" }

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
  Response 200: { ok: true }
```

### Email Accounts

```
GET /api/accounts
  Response 200: { accounts: EmailAccountDTO[] }

POST /api/accounts
  Body: { email: string, smtp_host: string, smtp_port: number,
          imap_host: string, imap_port: number, password: string }
  Response 201: { account: EmailAccountDTO }
  Response 400: { error: "connection_failed", message: string }
  Response 403: { error: "plan_limit_exceeded" }

DELETE /api/accounts/:id
  Response 200: { ok: true }
  Response 404: { error: "not_found" }

POST /api/accounts/:id/warmup/start
  Response 200: { status: "warming" }

POST /api/accounts/:id/warmup/stop
  Response 200: { status: "paused" }

GET /api/accounts/:id/score
  Response 200: { score: number, history: ScorePoint[], provider: string }
```

### Campaigns

```
GET /api/campaigns
  Response 200: { campaigns: CampaignDTO[] }

POST /api/campaigns
  Body: CampaignCreateDTO
  Response 201: { campaign: CampaignDTO }

PATCH /api/campaigns/:id
  Body: Partial<CampaignCreateDTO>
  Response 200: { campaign: CampaignDTO }

POST /api/campaigns/:id/start
  Response 200: { status: "running" }

POST /api/campaigns/:id/pause
  Response 200: { status: "paused" }

GET /api/campaigns/:id/stats
  Response 200: { sent: number, opened: number, replied: number,
                  bounced: number, open_rate: number, reply_rate: number }
```

### Contacts

```
GET /api/contacts?campaign_id=&status=
  Response 200: { contacts: ContactDTO[], total: number }

POST /api/contacts/import
  Body: multipart/form-data (CSV file)
  Response 200: { imported: number, skipped: number, errors: string[] }

DELETE /api/contacts/:id
  Response 200: { ok: true }
```

### Inbox

```
GET /api/inbox?status=&page=&limit=
  Response 200: { messages: InboxMessageDTO[], total: number }

PATCH /api/inbox/:id
  Body: { is_read?: boolean, lead_status?: string }
  Response 200: { message: InboxMessageDTO }

POST /api/inbox/:id/reply
  Body: { body: string }
  Response 201: { sent: true }
```

### Billing

```
POST /api/billing/checkout
  Body: { plan: "starter" | "pro" | "agency", period: "monthly" | "annual" }
  Response 200: { payment_url: string, payment_id: string }

POST /api/billing/webhook (YooKassa webhook)
  Body: YooKassaWebhookEvent
  Response 200: { ok: true }

GET /api/billing/subscription
  Response 200: { subscription: SubscriptionDTO }

POST /api/billing/cancel
  Response 200: { cancelled_at: string, access_until: string }

GET /api/billing/invoices
  Response 200: { invoices: InvoiceDTO[] }
```

---

## 4. Non-Functional Requirements (NFR)

### Performance

| Метрика | Target |
|---------|--------|
| API P95 latency | < 200ms |
| Dashboard load (LCP) | < 1.5s |
| Inbox Score update | Каждые 60 мин |
| Warmup job processing | ≤ 5 мин задержка в очереди |
| CSV import (10MB) | < 30 сек |
| Email sending throughput | 1,000 emails/час через BullMQ |

### Security

| Требование | Реализация |
|-----------|-----------|
| Аутентификация | JWT HS256, access 15 мин, refresh 7 дней, Redis blacklist |
| Пароли | bcrypt, cost factor 12 |
| Email credentials | AES-256-GCM, ключ из HSM/секрета env |
| Rate limiting | 100 req/мин анонимные, 1000 req/мин аутентифицированные |
| Input validation | Zod на всех API boundaries |
| HTML sanitization | DOMPurify перед записью в БД (campaign body) |
| Webhook security | YooKassa signature verification (SHA-256 HMAC) |
| Multi-tenancy | Все queries фильтруются по user_id |
| SQL injection | Prisma ORM, нет конкатенации строк |

### Availability

| Метрика | Target |
|---------|--------|
| Uptime | ≥ 99.5% (плановые работы: ночь МСК) |
| Warmup continuity | При падении API — warmup worker продолжает работу |
| Data backup | PostgreSQL dump ежедневно в MinIO |
| Recovery Time | < 2 часа (RTO), < 15 мин данных (RPO) |

### Scalability

- Horizontal: BullMQ worker масштабируется через дополнительные Docker replicas
- Vertical: VPS upgrade от 2 CPU/4GB до 8 CPU/16GB без изменений кода
- Database: PostgreSQL connection pooling через PgBouncer (при ≥500 concurrent users)
- Warmup pool: до 50,000 аккаунтов в пуле (индексы на email_accounts)

### Regulatory (38-ФЗ / 152-ФЗ)

| Требование | Реализация |
|-----------|-----------|
| Кнопка отписки | Автоматически добавляется в каждое письмо |
| 1-кликовая отписка | GET /unsubscribe?token=... без авторизации |
| Данные в РФ | VPS на серверах РФ (AdminVPS/HOSTKEY) |
| Персонализация | Валидатор требует ≥1 переменную в шаблоне |
| Ограничение рассылки | Rate limit 200 писем/день с нового аккаунта |

---

## 5. DTOs (TypeScript)

```typescript
type UserDTO = {
  id: string;
  email: string;
  full_name: string | null;
  plan: 'trial' | 'starter' | 'pro' | 'agency';
  trial_ends_at: string | null;
  created_at: string;
};

type EmailAccountDTO = {
  id: string;
  email: string;
  smtp_host: string;
  imap_host: string;
  status: 'connected' | 'warming' | 'paused' | 'error';
  inbox_score: number;
  in_warmup_pool: boolean;
  daily_limit: number;
  created_at: string;
};

type ScorePoint = {
  date: string;
  score: number;
  provider: string;
};

type CampaignDTO = {
  id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  from_account_id: string | null;
  steps: CampaignStepDTO[];
  schedule: {
    days: string[];
    start: string;
    end: string;
    timezone: string;
  };
  daily_limit: number;
  stats?: CampaignStats;
};

type CampaignStepDTO = {
  id: string;
  step_number: number;
  subject: string;
  body_html: string;
  delay_days: number;
};

type ContactDTO = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  position: string | null;
  custom_vars: Record<string, string>;
  status: 'active' | 'unsubscribed' | 'bounced';
};

type InboxMessageDTO = {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  is_read: boolean;
  lead_status: string | null;
  ai_draft: string | null;
  received_at: string;
  campaign?: { id: string; name: string };
  contact?: ContactDTO;
};

type SubscriptionDTO = {
  plan: string;
  status: 'active' | 'cancelled' | 'past_due' | 'trial';
  current_period_end: string | null;
  cancelled_at: string | null;
};
```

---

## 6. Warmup Engine Specification

### Алгоритм расчёта Inbox Score

```
Inbox Score = weighted_avg([
  inbox_rate_7d  × 0.50,   -- последние 7 дней (самый актуальный)
  inbox_rate_14d × 0.30,   -- последние 14 дней
  inbox_rate_30d × 0.20    -- последние 30 дней (историческая база)
])

где inbox_rate_Nd = (
  письма попавшие во входящие за N дней /
  все письма отправленные за N дней
) × 100

Провайдеры считаются отдельно: yandex, mailru, gmail
Итоговый Score = min(yandex_score, mailru_score, gmail_score)
  (worst case — определяет общий Score)
```

### Warmup Job Flow (BullMQ)

```
WarmupScheduler (cron: каждый час):
  1. Получить все аккаунты в статусе "warming"
  2. Для каждого аккаунта — определить daily_volume по рамп-апу:
     days_in_warmup <= 7  → 5–10 писем
     days_in_warmup <= 14 → 20–40 писем
     days_in_warmup <= 21 → 40–100 писем
     days_in_warmup >  21 → 100–200 писем
  3. Распределить отправку равномерно по часу
  4. Создать BullMQ jobs: { type: "warmup_send", account_id, partner_email }

WarmupSendWorker:
  1. Получить случайный partner аккаунт из пула
  2. Отправить письмо (Nodemailer) с human-like subject и body
  3. Добавить random delay 30s–5min перед IMAP-проверкой
  4. IMAP: открыть письмо у партнёра (imapflow)
  5. Если попало в спам — переместить во входящие
  6. С вероятностью 15% — сгенерировать ответ
  7. Записать warmup_event в БД

InboxScoreCalculator (cron: каждый час):
  1. Для каждого "warming" аккаунта — пересчитать score
  2. Сохранить snapshot в inbox_score_snapshots
  3. Обновить email_accounts.inbox_score
  4. Если score < 70% И снизился на >10% за 24ч → создать alert
```

### Rate Limits (Anti-Spam)

```
Яндекс:
  - Max 200 писем/день с любого аккаунта
  - Warmup: начинать с 5/день, рост согласно рамп-апу
  - Min delay между письмами: 30 секунд
  - Дневное окно: только 08:00–22:00 МСК

Mail.ru:
  - Max 200 писем/день
  - Те же правила

Human-like patterns:
  - Random delay ±20% к расписанию
  - Subject lines меняются из пула шаблонов (10+ вариантов)
  - Body: 3 предложения, уникализация через synonym substitution
```

---

## 7. AI Reply Agent Specification (v1.0)

### Categorization

```typescript
type ReplyCategory =
  | 'interested'        // Хочу узнать больше / Пришлите КП
  | 'meeting_request'   // Готов на встречу
  | 'not_now'           // Не актуально сейчас
  | 'not_interested'    // Не интересно категорически
  | 'unsubscribe'       // Отписаться
  | 'objection'         // Возражение (цена/время/доверие)
  | 'question'          // Конкретный вопрос о продукте
  | 'out_of_office'     // Auto-reply об отсутствии
  | 'spam_complaint';   // Жалоба
```

### Decision Logic

```
Confidence > 85% + категория ∈ [interested, meeting_request, question]:
  → Autopilot: AI отвечает сразу (если режим = Autopilot)

Confidence < 85% ИЛИ категория ∈ [objection, not_now]:
  → Draft Mode: создаётся черновик, уведомление пользователю

Категория ∈ [unsubscribe, spam_complaint, not_interested]:
  → Немедленная остановка sequence + уведомление пользователю (всегда Manual)

Категория = out_of_office:
  → Postpone: следующий follow-up сдвигается на +3 дня
```

### Claude API Prompt Structure

```
System:
  "Ты — профессиональный менеджер по продажам. Пишешь деловые письма
  на русском языке. Краткость важнее объёма. Никогда не используй
  обращения типа 'Уважаемый', 'С уважением'. Пиши как живой человек."

User:
  "Контекст кампании: {campaign_context}
   Предыдущие письма: {thread_history}
   Входящий ответ: {incoming_reply}
   Задача: напиши ответ на входящее письмо."
```

### Режимы работы (пользователь выбирает)

| Режим | Поведение |
|-------|----------|
| **Autopilot** | AI отвечает без участия пользователя (если confidence ≥ threshold) |
| **Draft** | AI создаёт черновик, пользователь редактирует и отправляет |
| **Manual** | AI только классифицирует, все ответы — вручную |

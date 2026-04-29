# BDD Test Scenarios — Поток

**Дата:** 2026-04-29 | **Метод:** Auto-generated from SPARC docs (validator swarm)
**Формат:** Gherkin (Given/When/Then)

---

## Содержание

1. [Auth Module](#1-auth-module)
2. [Email Account & DNS](#2-email-account--dns)
3. [Warmup Engine](#3-warmup-engine)
4. [Inbox Score](#4-inbox-score)
5. [Campaign Engine](#5-campaign-engine)
6. [Unified Inbox & AI Reply](#6-unified-inbox--ai-reply)
7. [Billing (YooKassa)](#7-billing-yookassa)
8. [Security Scenarios](#8-security-scenarios)
9. [38-ФЗ Compliance](#9-38-фз-compliance)

---

## 1. Auth Module

### US-01: Регистрация

```gherkin
Feature: User Registration

  Scenario: Успешная регистрация
    Given я не зарегистрирован
    When я отправляю POST /api/auth/register с { email: "user@yandex.ru", password: "SecurePass123", fullName: "Иван Иванов" }
    Then ответ 201 с { accessToken (TTL 15min), refreshToken (TTL 7days) }
    And пользователь создан в БД с plan='trial', trial_ends_at = now() + 7 days
    And password_hash использует bcrypt cost factor 12

  Scenario: Дублирующийся email
    Given email "user@yandex.ru" уже зарегистрирован
    When я отправляю POST /api/auth/register с тем же email
    Then ответ 409 { error: "email_already_exists" }

  Scenario: Слабый пароль
    When я отправляю POST /api/auth/register с { password: "123" }
    Then ответ 400 { error: "password_too_short" }
    And пользователь НЕ создан
```

### US-02: Аутентификация

```gherkin
Feature: Authentication

  Scenario: Успешный вход
    Given пользователь зарегистрирован с email/password
    When POST /api/auth/login с корректными credentials
    Then ответ 200 с { accessToken, refreshToken }
    And access token TTL = 15 минут
    And refresh token TTL = 7 дней

  Scenario: Неверные credentials
    When POST /api/auth/login с неверным паролем
    Then ответ 401 { error: "invalid_credentials" }
    And токены НЕ выдаются

  Scenario: Обновление access token
    Given у меня есть валидный refreshToken
    When POST /api/auth/refresh с { refreshToken }
    Then ответ 200 с новым accessToken (TTL 15min)
    And refreshToken остаётся валидным (не ротируется)

  Scenario: Logout + blacklist
    Given я залогинен с refreshToken
    When POST /api/auth/logout с { refreshToken }
    Then ответ 200
    And токен добавлен в Redis blacklist
    And повторный POST /api/auth/refresh с этим токеном → 401 { error: "token_revoked" }
```

### US-03: Сброс пароля

```gherkin
Feature: Password Reset

  Scenario: Запрос сброса — успешно
    Given пользователь user@yandex.ru зарегистрирован
    When POST /api/auth/forgot-password { email: "user@yandex.ru" }
    Then ответ 200 (независимо от результата)
    And email с reset link отправлен
    And Redis ключ reset:{token} создан с TTL 3600s

  Scenario: Неизвестный email (no enumeration)
    When POST /api/auth/forgot-password { email: "nobody@test.com" }
    Then ответ 200 (не раскрываем существование email)
    And email НЕ отправлен

  Scenario: Успешный сброс
    Given valid reset token (< 1h)
    When POST /api/auth/reset-password { token, newPassword: "NewPass123!" }
    Then ответ 200 { success: true }
    And password_hash обновлён (bcrypt cost 12)
    And токен удалён из Redis (single-use)

  Scenario: Просроченный/использованный токен
    When POST /api/auth/reset-password с expired/used token
    Then ответ 400 { error: "token_expired_or_used" }

  Scenario: Rate limit сброса пароля
    Given 3 запроса уже отправлены за 1 час
    When 4-й POST /api/auth/forgot-password
    Then ответ 429 Too Many Requests
```

---

## 2. Email Account & DNS

### US-04: Подключение email аккаунта

```gherkin
Feature: Email Account Connection

  Scenario: Успешное подключение Яндекс аккаунта
    Given пользователь plan='starter' (3 аккаунта доступно)
    When POST /api/accounts с { email, password, smtpHost: "smtp.yandex.com", smtpPort: 465, imapHost: "imap.yandex.com", imapPort: 993 }
    Then ответ 201 с { id, email, status: "connected" }
    And credentials_enc сохранены как AES-256-GCM зашифрованный BYTEA
    And пароль НИКОГДА не возвращается в ответе

  Scenario: Неверные credentials
    When POST /api/accounts с неверным паролем
    Then ответ 400 { error: "smtp_auth_failed" }
    And аккаунт НЕ сохраняется

  Scenario: Превышение лимита аккаунтов по плану
    Given у пользователя plan='starter' уже 3 подключённых аккаунта
    When POST /api/accounts с 4-м аккаунтом
    Then ответ 403 { error: "plan_limit_exceeded", limit: 3, current: 3 }
    And показывается предложение перейти на Про

  Scenario: DNS check после подключения
    Given аккаунт подключён с доменом company.ru
    Then dns_checked_at устанавливается
    And dns_spf, dns_dkim, dns_dmarc заполняются (true/false)
    And GET /api/accounts/:id возвращает DNS статус
```

### US-06: Запуск прогрева

```gherkin
Feature: Warmup Activation

  Scenario: Запуск прогрева для нового аккаунта
    Given аккаунт подключён, DNS проверен
    When POST /api/accounts/:id/warmup/start
    Then ответ 200 { status: "warming", warmupStartedAt }
    And BullMQ warmup job создан в очереди
    And warmup_started_at записана в email_accounts
    And первое тестовое письмо отправлено за ≤5 мин

  Scenario: Запуск без DMARC записи
    Given аккаунт подключён, dns_dmarc = false
    When POST /api/accounts/:id/warmup/start
    Then ответ 200 с предупреждением { warning: "dmarc_missing" }
    And прогрев всё равно запускается (не блокируется)
    And inbox_score начинает обновляться

  Scenario: Остановка прогрева
    Given аккаунт в состоянии warming
    When POST /api/accounts/:id/warmup/stop
    Then ответ 200 { status: "paused" }
    And BullMQ jobs переходят в статус paused
    And новые warmup jobs не создаются
```

---

## 3. Warmup Engine

### Warmup рамп-ап логика

```gherkin
Feature: Warmup Ramp-up Schedule

  Scenario: День 1–7 (начальный прогрев)
    Given аккаунт на warmup день 3
    When WarmupScheduler запускается
    Then getDailyVolume возвращает значение в диапазоне 5–10
    And создаётся от 5 до 10 WarmupSendJob в BullMQ

  Scenario: День 8–14 (умеренный прогрев)
    Given аккаунт на warmup день 10
    When WarmupScheduler запускается
    Then getDailyVolume возвращает 20–40 писем

  Scenario: День 15–21 (активный прогрев)
    Given аккаунт на warmup день 18
    Then getDailyVolume возвращает 40–100 писем

  Scenario: Спам → Inbox (критический сигнал)
    Given warmup email попало в папку Спам партнёрского аккаунта
    When processWarmupSend обнаруживает письмо в Spam
    Then письмо перемещается в Inbox (imapMove)
    And создаётся warmup_event с event_type = 'moved_from_spam'
    And inbox_score_at записывается в событие

  Scenario: Партнёрский ответ (15% chance)
    Given inboxLanded = true
    And Math.random() < 0.15
    When processWarmupSend
    Then отправляется ответное письмо от партнёра
    And warmup_event с event_type = 'replied' создаётся
```

---

## 4. Inbox Score

### US-07: Inbox Score Dashboard

```gherkin
Feature: Inbox Score Dashboard

  Scenario: Отображение актуального Score
    Given аккаунт прогревается 14 дней с events в warmup_events
    When GET /api/accounts/:id/score
    Then ответ 200 { score: 0–100, provider: "combined", updatedAt }
    And score рассчитан по формуле: (50% × 7d_rate + 30% × 14d_rate + 20% × 30d_rate)
    And score обновляется не реже 1 раза в 60 минут

  Scenario: Score цветовая индикация
    Given score = 52 (ниже 70)
    Then GET /api/accounts/:id/score возвращает { score: 52, color: "red" }

    Given score = 77 (между 70 и 84)
    Then { color: "yellow" }

    Given score = 90 (выше 85)
    Then { color: "green" }

  Scenario: История Score (30 дней)
    When GET /api/accounts/:id/score/history?days=30
    Then ответ 200 с массивом { date, score, provider }
    And данные отсортированы по дате ASC
    And пустые дни не имеют null записей (gap filling не требуется для MVP)

  Scenario: Alert при падении ниже 70%
    Given score только что обновился с 73 до 62
    When recalculateAllInboxScores завершает расчёт
    Then inbox_alerts запись создана { accountId, score: 62, alertType: "score_drop" }
    And дубликат alert не создаётся чаще 1 раза в 24 часа для этого аккаунта
```

---

## 5. Campaign Engine

### US-10: Campaign Builder

```gherkin
Feature: Campaign Builder

  Scenario: Создание кампании с sequence
    Given пользователь plan='pro'
    When POST /api/campaigns с { name: "Q2 Outreach", steps: [{ delayDays: 0, subject, body }, { delayDays: 7, ... }] }
    Then ответ 201 { id, status: "draft", stepCount: 2 }
    And расписание отправки: Mon–Fri 09:00–18:00 MSK

  Scenario: Запуск кампании
    Given кампания в статусе "draft" с 100 контактами
    When POST /api/campaigns/:id/start
    Then ответ 200 { status: "running" }
    And BullMQ jobs созданы для первого step
    And email_sends записи созданы со status='queued'
    And суточный лимит не превышает 200 писем на аккаунт

  Scenario: Кампания останавливается при ответе
    Given кампания запущена, contact@domain.ru ответил
    When processEmailReply обнаруживает ответ
    Then email_sends для этого контакта переходят в status='cancelled'
    And следующие steps для этого контакта не создаются
    And ответ появляется в Unified Inbox

  Scenario: Персонализация переменных
    Given шаблон письма содержит {{ firstName }}
    And contact.firstName = "Михаил"
    When substituteVariables
    Then {{ firstName }} → "Михаил" в итоговом письме
    And отсутствующие переменные → предупреждение (не блокировка)
```

### US-11: CSV Import

```gherkin
Feature: CSV Contact Import

  Scenario: Успешный импорт
    Given CSV файл 2MB с колонками email,firstName,lastName,company (UTF-8)
    When POST /api/campaigns/:id/contacts/import с файлом
    Then ответ 200 { imported: 450, skipped: 12, errors: 0 }
    And дублирующиеся email → skipped (не ошибка)
    And contacts записаны в БД с campaign_id

  Scenario: Файл превышает лимит
    When POST /api/campaigns/:id/contacts/import с файлом > 10MB
    Then ответ 400 { error: "file_too_large", maxMB: 10 }

  Scenario: Невалидный CSV формат
    When POST с файлом без заголовка email
    Then ответ 400 { error: "missing_required_column", column: "email" }
    And первые 10 невалидных строк возвращаются в ответе

  Scenario: Unsubscribed контакт
    Given user@company.ru есть в таблице unsubscribes
    When импортируется файл с этим email
    Then контакт создаётся со status='unsubscribed'
    And в кампанию НЕ включается для отправки
```

---

## 6. Unified Inbox & AI Reply

### US-13: Unified Inbox

```gherkin
Feature: Unified Inbox

  Scenario: Просмотр входящих ответов
    Given кампания отправила письма и получила 5 ответов
    When GET /api/inbox
    Then ответ 200 с массивом { fromEmail, fromName, campaignName, subject, receivedAt, isRead, leadStatus }
    And сообщения отсортированы по receivedAt DESC
    And threading: ответы сгруппированы по thread (send_id)

  Scenario: Отметить как прочитанное
    When POST /api/inbox/:id/read
    Then ответ 200
    And inbox_messages.is_read = true
    And счётчик непрочитанных обновляется

  Scenario: Ручной ответ
    Given открыто сообщение в Unified Inbox
    When POST /api/inbox/:id/reply { body: "Спасибо, готов к звонку" }
    Then ответ 201 { sent: true }
    And письмо отправлено через SMTP с email_account
    And ответ добавлен в тред (is_reply = true)

  Scenario: Смена статуса лида
    When PATCH /api/inbox/:id/lead-status { status: "interested" }
    Then ответ 200 { leadStatus: "interested" }
    And inbox_messages.lead_status обновлён
```

### AI Reply Agent

```gherkin
Feature: AI Reply Agent (v1.0)

  Scenario: Классификация ответа через Claude API
    Given inbox_message с телом "Расскажите подробнее о вашем продукте"
    When classifyReply вызывает Claude API (claude-sonnet-4-6)
    Then возвращает { category: "QUESTION", confidence: 92 }
    And результат сохраняется в inbox_messages (ai_category, ai_confidence)

  Scenario: Autopilot mode — автоматическая отправка
    Given user.ai_reply_mode = 'autopilot'
    And classifyReply вернул { category: "INTERESTED", confidence: 95 }
    And user.ai_confidence_threshold = 80
    When processAIReply
    Then confidence 95 >= threshold 80 → автоматическая отправка
    And ai_sent_at проставляется

  Scenario: Draft mode — только черновик
    Given user.ai_reply_mode = 'draft'
    When processAIReply
    Then draft сохраняется в inbox_messages.ai_draft
    And письмо НЕ отправляется автоматически

  Scenario: DO_NOT_CONTACT категория
    Given classifyReply → { category: "DO_NOT_CONTACT" }
    When processAIReply
    Then email добавляется в unsubscribes
    And все активные кампании для этого контакта останавливаются
    And AI ответ НЕ генерируется
```

---

## 7. Billing (YooKassa)

### US-15: Оплата подписки

```gherkin
Feature: YooKassa Billing

  Scenario: Первая оплата (checkout)
    Given пользователь plan='trial', выбрал план 'pro' monthly
    When POST /api/billing/checkout { plan: "pro", period: "monthly" }
    Then создаётся YooKassa Payment на 499,000 kopecks (₽4,990)
    And ответ 200 { paymentUrl: "https://yookassa.ru/..." }
    And subscription создана со status='pending'

  Scenario: Webhook payment.succeeded — активация
    Given YooKassa отправляет webhook { event: "payment.succeeded", paymentId }
    And подпись SHA-256 HMAC валидна
    When POST /api/billing/webhook
    Then subscription.status = 'active'
    And users.plan = 'pro'
    And payment_event записан (идемпотентно — yookassa_event_id UNIQUE)

  Scenario: Рекуррентная оплата — успех
    Given subscription active, current_period_end = сегодня
    When processRecurringBilling cron
    Then YooKassa createPayment с сохранённым payment_method_id
    And new_period_end = old_period_end + 1 month

  Scenario: 3 неудачные попытки renewal
    Given 2 предыдущих renewal attempt неудачны
    When 3-я попытка также failsАnd
    Then subscription.status = 'past_due'
    And users.plan = 'free'
    And renewal_attempts = 3 (персистировано в БД)
    And уведомление отправлено пользователю

  Scenario: Отмена подписки
    Given subscription active, period_end = 2026-05-29
    When POST /api/billing/cancel
    Then ответ 200 { accessUntil: "2026-05-29T..." }
    And subscription.status = 'cancelled', cancelled_at = now()
    And plan downgrade job запланирован на period_end
    And доступ сохраняется до 2026-05-29
```

---

## 8. Security Scenarios

### JWT Security

```gherkin
Feature: JWT Authentication Security

  Scenario: Истёкший access token
    Given access token истёк (> 15 минут)
    When GET /api/accounts с истёкшим токеном
    Then ответ 401 { error: "token_expired" }

  Scenario: Tampered access token
    Given token изменён (invalid signature)
    When GET /api/accounts
    Then ответ 401 { error: "invalid_token" }

  Scenario: Использование revoked refresh token
    Given refresh token отозван (logout)
    When POST /api/auth/refresh с отозванным токеном
    Then ответ 401 { error: "token_revoked" }

  Scenario: Brute-force на login endpoint
    Given 101 неудачных попыток входа за 60 секунд с одного IP
    When 102-й POST /api/auth/login
    Then ответ 429 Too Many Requests
    And X-RateLimit-Reset заголовок возвращён
```

### YooKassa Webhook Security

```gherkin
Feature: YooKassa Webhook Security

  Scenario: Webhook с невалидной подписью — отклонить
    Given POST /api/billing/webhook с body event
    And HTTP заголовок Digest: SHA-256=<INVALID_HMAC>
    When обработчик вебхука
    Then ответ 401
    And subscription НЕ активируется
    And security event логируется

  Scenario: Replay attack — дубликат события
    Given payment_events уже содержит yookassa_event_id = "evt_123"
    When POST /api/billing/webhook с тем же evt_123
    Then ответ 200 (idempotent)
    And subscription НЕ дублируется (UNIQUE constraint)

  Scenario: Webhook с валидной подписью — обработать
    Given подпись SHA-256 HMAC валидна
    When POST /api/billing/webhook { event: "payment.succeeded" }
    Then ответ 200
    And subscription активирована
```

### Multi-tenant Isolation

```gherkin
Feature: Multi-tenant Data Isolation

  Scenario: Пользователь не может видеть аккаунты другого пользователя
    Given user_A и user_B оба зарегистрированы
    And user_A создал account_X
    When user_B делает GET /api/accounts/:account_X_id
    Then ответ 404 (не 403 — не раскрываем существование ресурса)

  Scenario: Пользователь не может изменить кампанию другого пользователя
    Given user_A создал campaign_Y
    When user_B делает POST /api/campaigns/:campaign_Y_id/start с токеном user_B
    Then ответ 404

  Scenario: JWT без userId — отклонить
    When GET /api/accounts без Authorization заголовка
    Then ответ 401 { error: "unauthorized" }
```

### Input Validation

```gherkin
Feature: Input Validation (Zod)

  Scenario: SQL injection attempt
    When POST /api/auth/login { email: "' OR 1=1 --", password: "x" }
    Then ответ 400 { error: "validation_error" } (Zod rejection, не SQL error)
    And БД запрос НЕ выполняется

  Scenario: XSS в HTML контенте кампании
    Given POST /api/campaigns с body содержащим <script>alert('xss')</script>
    When сохраняется в БД
    Then контент прошёл DOMPurify.sanitize() перед записью
    And script тег удалён из сохранённого HTML

  Scenario: Oversized request body
    When POST /api/campaigns/:id/contacts/import с файлом 51MB
    Then ответ 413 Payload Too Large
    And файл не записывается на диск
```

---

## 9. 38-ФЗ Compliance

```gherkin
Feature: 38-ФЗ Unsubscribe Compliance

  Scenario: Ссылка отписки присутствует в каждом письме
    Given кампания с шаблоном без ссылки отписки
    When processEmailSend формирует итоговое письмо
    Then appendUnsubscribeLink добавляет ссылку server-side
    And ссылка содержит HMAC-signed unsubscribe token
    And ссылка ведёт на GET /unsubscribe?token=...

  Scenario: Одноклик отписка без авторизации
    Given пользователь получил письмо с unsubscribe link
    When GET /unsubscribe?token=<valid_token> (без логина)
    Then ответ 200 "Вы отписаны"
    And email добавлен в unsubscribes таблицу
    And будущие отправки на этот email блокируются

  Scenario: Unsubscribed контакт не получает письма
    Given email contact@domain.ru в таблице unsubscribes
    When getPendingSends строит очередь
    Then contact@domain.ru исключён из очереди
    And email_sends создаётся со status='skipped' (не 'queued')

  Scenario: Повторная попытка отписки (идемпотентность)
    Given email уже в unsubscribes
    When GET /unsubscribe?token=<another_valid_token>
    Then ответ 200 "Вы отписаны" (не ошибка)
    And дубликат в unsubscribes не создаётся (UNIQUE email)

  Scenario: Невалидный/просроченный токен отписки
    When GET /unsubscribe?token=<invalid_or_tampered>
    Then ответ 400 { error: "invalid_unsubscribe_token" }
    And email НЕ добавляется в unsubscribes
```

---

## Приоритеты реализации

| Priority | Scenario Group | Reason |
|----------|---------------|--------|
| P0 | Auth (US-01, US-02, US-03) | Блокирует всё остальное |
| P0 | 38-ФЗ Compliance | Юридический риск |
| P0 | YooKassa Webhook Security | Финансовая безопасность |
| P1 | Email Account (US-04) | Core product |
| P1 | Warmup Engine | Core product differentiator |
| P1 | Multi-tenant Isolation | Data security |
| P2 | Campaign Engine (US-10, US-11) | Revenue-generating features |
| P2 | Billing (US-15) | Monetization |
| P3 | Unified Inbox (US-13) | User experience |
| P3 | AI Reply (v1.0) | Feature differentiation |

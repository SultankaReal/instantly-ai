# Refinement: Поток

**Дата:** 2026-04-29 | **Источник:** Specification.md + Architecture.md + Pseudocode.md

---

## Содержание

1. [Edge Cases по модулям](#1-edge-cases-по-модулям)
2. [Test Strategy](#2-test-strategy)
3. [Performance Considerations](#3-performance-considerations)
4. [Security Gap Analysis](#4-security-gap-analysis)
5. [Known Limitations & Mitigations](#5-known-limitations--mitigations)
6. [Error Handling Catalog](#6-error-handling-catalog)

---

## 1. Edge Cases по модулям

### 1.1 Auth

| # | Edge Case | Ожидаемое поведение |
|---|-----------|---------------------|
| A1 | Регистрация с email в смешанном регистре (`User@YANDEX.ru`) | Normalize to lowercase перед сохранением и проверкой уникальности |
| A2 | Одновременные регистрации с одним email (race condition) | UNIQUE constraint на users.email + DB-level error → 409 Conflict |
| A3 | Refresh token использован дважды за 1 секунду | Идемпотентен: второй запрос возвращает 401 (Redis DEL после первого refresh) |
| A4 | Trial истёк — пользователь пробует войти | Вход разрешён, но features за paywall → 403 при попытке использовать платный функционал |
| A5 | JWT_SECRET ротируется в env при живых сессиях | Все access tokens инвалидируются (новый secret → verify fails). Refresh tokens тоже. Пользователи вынуждены перелогиниться — это ожидаемо при ротации секрета |
| A6 | Пользователь удаляет аккаунт во время активной сессии | `authenticate()` проверяет `db.users.findById` — если null → 401 на следующем запросе |

### 1.2 Email Accounts

| # | Edge Case | Ожидаемое поведение |
|---|-----------|---------------------|
| B1 | App Password Яндекс содержит пробелы | Trim перед SMTP-проверкой; документировать в onboarding |
| B2 | Пользователь добавляет один аккаунт дважды | UNIQUE (user_id, email) → 409 с сообщением "Аккаунт уже подключён" |
| B3 | SMTP работает, IMAP недоступен | Раздельные ошибки: "IMAP подключение не удалось. Включите IMAP в настройках почты." |
| B4 | Яндекс блокирует аккаунт за подозрительную активность | `status = 'error'`, alert пользователю, warmup приостанавливается автоматически |
| B5 | Аккаунт удалён пользователем пока warmup job в очереди | Job проверяет `account.status` перед отправкой → если not found → job помечается как skipped, не failed |
| B6 | Пользователь меняет App Password Яндекс | Нужен endpoint `PUT /api/accounts/:id/credentials` для обновления credentials_enc без пересоздания аккаунта |
| B7 | 100 seed-аккаунтов в пуле, но пользователь в пуле один | partner = pickRandom(pool, exclude: self) возвращает seed аккаунты → warmup работает |
| B8 | ENCRYPTION_KEY ротируется | Все существующие credentials_enc становятся нечитаемыми → нужна миграция: decrypt old → encrypt new → update. Предусмотреть key versioning |

### 1.3 Warmup Engine

| # | Edge Case | Ожидаемое поведение |
|---|-----------|---------------------|
| C1 | Warmup pool пустой (0 аккаунтов кроме текущего) | `pickRandom(pool, exclude: self)` возвращает null → job skipped, не failed. Alert: "Добавьте ещё аккаунты для лучшего прогрева" |
| C2 | Все аккаунты в пуле паузированы | То же: jobs не создаются, warmup не происходит. Score не падает (просто не растёт) |
| C3 | Яндекс меняет IMAP структуру папок спама | Scan нескольких вероятных папок: 'Spam', 'Спам', 'Junk'. При ошибке — log warn, не fail job |
| C4 | Warmup письмо попало в спам партнёра + партнёр offline | Письмо остаётся в спаме → score не растёт. Worker не ждёт партнёра — следующая попытка через час |
| C5 | Резкое увеличение отправок (пользователь меняет dailyLimit) | Новый лимит применяется со следующего часового цикла. Нет retroactive пересчёта |
| C6 | Warmup job выполняется дольше 5 минут (медленный IMAP) | BullMQ timeout: `jobOptions.timeout = 300_000` (5 мин). Тimed-out job retry с backoff |
| C7 | Два worker'а берут одну и ту же пару аккаунтов одновременно | BullMQ atomic job lock предотвращает дублирование. Дополнительно: уникальность по `(sender_id, partner_id, date)` на уровне warmup_events рассматривается — но не обязательна т.к. небольшой дубль не вреден |
| C8 | score рассчитывается с 0 events (новый аккаунт) | `sent = 0` → `calculateInboxRate` возвращает 0. Корректно — нет данных = 0% |

### 1.4 Campaign Engine

| # | Edge Case | Ожидаемое поведение |
|---|-----------|---------------------|
| D1 | CSV с 10,000 контактов загружается | Stream-based parsing (не в памяти целиком), progress updates через SSE или polling |
| D2 | CSV с BOM (UTF-8 BOM от Excel) | csv-parse library обрабатывает BOM автоматически. Протестировать явно |
| D3 | Переменная `{{name}}` в шаблоне, но в CSV колонка `first_name` | Нет матчинга — переменная остаётся нетронутой `{{name}}`. Валидатор предупреждает, не блокирует |
| D4 | Контакт отписался пока его письмо было в очереди | Worker проверяет `unsubscribes` перед отправкой → `status = 'skipped'` |
| D5 | Email аккаунт отключён пока кампания активна | `from_account_id → status = 'error'` → campaign переходит в `paused`. Уведомление пользователю |
| D6 | Sequence Step 2 настроен на delay_days = 0 | Валидация: `delay_days >= 1` для step_number >= 2. Step 1 может быть 0 (immediate) |
| D7 | Пользователь меняет тело письма в активной кампании | Изменения применяются только к будущим queued sends. Уже отправленные — неизменны |
| D8 | Кампания с 0 контактов запускается | `status = 'running'` но нет pending sends → кампания ждёт добавления контактов |
| D9 | Все контакты обработаны (sequence завершён) | Campaign автоматически переходит в `status = 'completed'` |
| D10 | Timezone неверный (пользователь вводит "Moscow/Russia") | Валидация против `Intl.supportedValuesOf('timeZone')`. Fallback: 'Europe/Moscow' |

### 1.5 Unified Inbox + AI Reply

| # | Edge Case | Ожидаемое поведение |
|---|-----------|---------------------|
| E1 | Один человек отвечает дважды на одно письмо | Оба ответа сохраняются в inbox_messages, threading по `send_id`. Оба видны в UI |
| E2 | Ответ содержит `<script>` теги | `body_html` сохраняется RAW. Рендеринг: `<iframe srcdoc={body_html} sandbox="allow-same-origin" />` — XSS изолирован |
| E3 | Claude API недоступен (timeout/outage) | ai-reply job retries 3 раза с backoff. После 3 неудач → status notify, пользователь обрабатывает вручную |
| E4 | Claude возвращает невалидный JSON при классификации | `try/catch` вокруг `JSON.parse`. Fallback: `{ category: 'question', confidence: 50 }` → Draft mode |
| E5 | AI Reply отправлен в Autopilot, клиент жалуется | UI показывает `ai_sent_at`, текст черновика. Пользователь видит что было отправлено. Undo недоступен (письмо ушло) |
| E6 | inbox_messages накапливаются (1M+ для крупного агентства) | Pagination на API (default limit 50). Архивирование сообщений старше 6 мес (future). Index на `(user_id, is_read, received_at DESC)` |
| E7 | Ответ пришёл от адреса не из кампании (cold inbound) | `send_id = null`, ответ сохраняется в inbox с `campaign = null`. Показывается в общем Inbox |

### 1.6 Billing

| # | Edge Case | Ожидаемое поведение |
|---|-----------|---------------------|
| F1 | Webhook от YooKassa приходит дважды | `UNIQUE yookassa_event_id` + idempotency check перед обработкой → второй вызов → return 200 без обработки |
| F2 | Пользователь закрывает страницу оплаты до завершения | Payment остаётся в `pending` у YooKassa. При следующем checkout — новый payment. Старый истечёт (YooKassa auto-expires) |
| F3 | Webhook приходит раньше чем redirect return_url | Нормальный сценарий — webhook надёжнее redirect. Подписка активируется по webhook |
| F4 | Рекуррентный платёж не прошёл (карта заблокирована) | 3 retry в течение 3 дней. После 3 неудач → `past_due` → downgrade на trial, email уведомление |
| F5 | Пользователь отменяет + сразу подписывается заново | `UPSERT subscriptions WHERE user_id` → обновляет существующую запись. `cancelled_at` обнуляется |
| F6 | Годовая подписка отменяется на 3й месяц | Доступ до `current_period_end` (через 9 мес). Нет partial refund (описано в ToS) |
| F7 | YooKassa меняет API (breaking change) | SDK версия зафиксирована в package.json. Обновление только после тестирования в sandbox |

### 1.7 Multi-tenancy

| # | Edge Case | Ожидаемое поведение |
|---|-----------|---------------------|
| G1 | Пользователь угадывает UUID чужого аккаунта | Каждый query: `WHERE id = $1 AND user_id = $2`. UUID v4 непредсказуем, но авторизация — second line of defense |
| G2 | Массовый import контактов дублирует контакты другого пользователя | UNIQUE (user_id, email) — у разных пользователей может быть одинаковый email контакта |
| G3 | Агентский workspace: admin добавляет sub-client (v1.0) | Sub-client изолирован: кампании, аккаунты, контакты отдельно. Агент видит всё |

---

## 2. Test Strategy

### Пирамида тестов

```
            E2E (5%)
         ─────────────
       Integration (25%)
     ─────────────────────
          Unit (70%)
```

### Unit Tests — Vitest

**Что тестируем:**

```typescript
// auth.service.test.ts
describe('AuthService', () => {
  it('should hash password with bcrypt cost 12', async () => {
    const hash = await authService.hashPassword('test123456')
    expect(bcrypt.getRounds(hash)).toBe(12)
  })

  it('should not reveal whether email or password is wrong', async () => {
    await expect(authService.login('unknown@example.com', 'wrong'))
      .rejects.toThrow('invalid_credentials')
    await expect(authService.login('known@example.com', 'wrong'))
      .rejects.toThrow('invalid_credentials')
    // Same error message — no enumeration
  })

  it('should blacklist refresh token on logout', async () => {
    const { refreshToken } = await authService.login(email, password)
    await authService.logout(refreshToken, userId)
    await expect(authService.refresh(refreshToken)).rejects.toThrow('token_invalid')
  })
})

// inbox-score.service.test.ts
describe('InboxScoreCalculator', () => {
  it('should return 0 for account with no events', () => {
    expect(calculateInboxRate([])).toBe(0)
  })

  it('should weight recent events more heavily (50/30/20)', () => {
    // 100% last 7d, 50% last 14d, 0% last 30d
    // Expected: 100*0.5 + 50*0.3 + 0*0.2 = 65
    const score = recalculateWithMockedEvents(...)
    expect(score).toBe(65)
  })

  it('should count moved_from_spam as 0.5 weight', () => {
    const events = [
      { eventType: 'sent' },
      { eventType: 'moved_from_spam' },  // 0.5 weight
    ]
    expect(calculateInboxRate(events)).toBe(50)  // 0.5/1 * 100
  })
})

// campaign.service.test.ts
describe('CampaignService', () => {
  it('should stop sequence for replied contact', () => {
    // Contact replied to step 1 → step 2 should not be queued
  })

  it('should substitute {{name}} variable', () => {
    expect(substituteVariables('Привет, {{name}}!', { firstName: 'Алексей' }))
      .toBe('Привет, Алексей!')
  })

  it('should detect unsubstituted variables', () => {
    expect(hasUnsubstitutedVariables('{{company}} пишет')).toBe(true)
    expect(hasUnsubstitutedVariables('Алексей пишет')).toBe(false)
  })

  it('should always append unsubscribe link', () => {
    const html = appendUnsubscribeLink('<p>Hello</p>', { contactEmail: 'test@test.com', ... })
    expect(html).toContain('/unsubscribe?token=')
  })

  it('should respect schedule window', () => {
    const campaign = { scheduleDays: ['mon','tue'], scheduleStart: '09:00', scheduleEnd: '18:00', timezone: 'Europe/Moscow' }
    // Monday 10:00 MSK → in window
    expect(isInScheduleWindow(campaign, new Date('2026-04-27T07:00:00Z'))).toBe(true)
    // Sunday 10:00 MSK → not in window
    expect(isInScheduleWindow(campaign, new Date('2026-04-26T07:00:00Z'))).toBe(false)
  })
})

// billing.service.test.ts
describe('BillingService', () => {
  it('should verify YooKassa webhook signature', () => {
    const validSig = computeExpectedSig(rawBody, secret)
    expect(verifyYooKassaSignature(rawBody, validSig)).toBe(true)
    expect(verifyYooKassaSignature(rawBody, 'invalid')).toBe(false)
  })

  it('should be idempotent on duplicate webhook events', async () => {
    await billingService.handleWebhook(event)
    await billingService.handleWebhook(event)  // same event
    // Subscription updated only once
    const sub = await db.subscriptions.findOne({ userId })
    expect(sub.renewalAttempts).toBe(0)
  })
})

// ai-reply.service.test.ts
describe('AIReplyService', () => {
  it('should always stop_sequence for unsubscribe category', () => {
    const action = determineAction({ category: 'unsubscribe', confidence: 30 }, 'autopilot', 85)
    expect(action).toBe('stop_sequence')
  })

  it('should require high confidence for autopilot', () => {
    const lowConf = determineAction({ category: 'interested', confidence: 70 }, 'autopilot', 85)
    expect(lowConf).toBe('draft')  // not autopilot — confidence too low

    const highConf = determineAction({ category: 'interested', confidence: 90 }, 'autopilot', 85)
    expect(highConf).toBe('autopilot')
  })

  it('should fallback to draft on Claude API parse error', async () => {
    jest.spyOn(anthropic, 'messages.create').mockResolvedValueOnce({ content: [{ text: 'invalid json' }] })
    const result = await classifyReply('Test reply', [], null)
    expect(result.category).toBe('question')  // fallback
    expect(result.confidence).toBe(50)
  })
})
```

**Coverage target:** ≥ 80% line coverage по всем services

### Integration Tests — Vitest + Testcontainers

```typescript
// tests/integration/account.integration.test.ts
// IMPORTANT: Never mock the database — use real PostgreSQL via testcontainers

describe('Email Account Integration', () => {
  let postgres: StartedPostgreSqlContainer
  let prisma: PrismaClient

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start()
    prisma = new PrismaClient({ datasourceUrl: postgres.getConnectionUri() })
    await prisma.$executeRawUnsafe(readFileSync('docs/schema.sql', 'utf8'))
  })

  afterAll(async () => {
    await prisma.$disconnect()
    await postgres.stop()
  })

  it('should enforce plan limits for starter (3 accounts)', async () => {
    const user = await createTestUser(prisma, { plan: 'starter' })
    await createTestAccounts(prisma, user.id, 3)

    await expect(accountService.connectAccount(user.id, mockInput))
      .rejects.toThrow('plan_limit_exceeded')
  })

  it('should encrypt credentials before saving', async () => {
    const user = await createTestUser(prisma, { plan: 'pro' })
    const account = await accountService.connectAccount(user.id, {
      email: 'test@yandex.ru',
      password: 'secret123',
      smtpHost: 'smtp.yandex.com',
      ...
    })

    // Raw DB — should be encrypted bytes, not plaintext
    const raw = await prisma.$queryRaw`SELECT credentials_enc FROM email_accounts WHERE id = ${account.id}`
    expect(raw[0].credentials_enc.toString()).not.toContain('secret123')
  })
})

// tests/integration/campaign.integration.test.ts
describe('Campaign Send Integration', () => {
  it('should not send to unsubscribed contact', async () => {
    const contact = await createTestContact(prisma, { email: 'unsubbed@example.com' })
    await prisma.unsubscribes.create({ data: { email: 'unsubbed@example.com' } })

    await processEmailSend(mockEmailSendJob)

    const send = await prisma.emailSends.findUnique({ where: { id: mockEmailSendJob.sendId } })
    expect(send.status).toBe('skipped')
  })

  it('should append unsubscribe link to every email', async () => {
    const sentEmails: string[] = []
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: (opts) => { sentEmails.push(opts.html); return { messageId: 'test' } }
    })

    await processEmailSend(mockEmailSendJob)

    expect(sentEmails[0]).toContain('/unsubscribe?token=')
  })
})
```

### E2E Tests — Playwright

```typescript
// tests/e2e/onboarding.spec.ts
test('User completes onboarding and sees Aha Moment', async ({ page }) => {
  // 1. Register
  await page.goto('/register')
  await page.fill('[name=email]', 'test@example.com')
  await page.fill('[name=password]', 'password123')
  await page.click('button[type=submit]')

  // 2. Onboarding wizard
  await expect(page).toHaveURL('/onboarding')
  await page.click('text=Яндекс.Почта (большинство)')
  await page.click('text=Далее')

  // 3. Connect account
  await page.fill('[name=email]', 'test@yandex.ru')
  await page.fill('[name=password]', 'app_password')
  await page.click('text=Подключить')
  await expect(page.locator('.account-status')).toContainText('connected')

  // 4. Start warmup
  await page.click('text=Запустить прогрев')
  await expect(page.locator('.inbox-score')).toBeVisible()
})

// tests/e2e/billing.spec.ts
test('User subscribes via YooKassa', async ({ page }) => {
  await loginAs(page, 'trial_user')
  await page.goto('/billing')
  await page.click('text=Перейти на Про')

  // Should redirect to YooKassa
  await expect(page).toHaveURL(/yookassa\.ru/)
})

// tests/e2e/unsubscribe.spec.ts
test('Unsubscribe link works without authentication', async ({ page }) => {
  const token = generateUnsubscribeToken('contact@example.com')
  await page.goto(`/unsubscribe?token=${token}`)

  await expect(page.locator('h1')).toContainText('Вы отписаны')

  // Verify in DB
  const unsub = await prisma.unsubscribes.findUnique({ where: { email: 'contact@example.com' } })
  expect(unsub).toBeTruthy()
})
```

### Performance Tests — k6

```javascript
// tests/performance/api-load.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // ramp up
    { duration: '1m',  target: 200 },  // sustained load
    { duration: '30s', target: 0 },    // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% of requests < 200ms
    http_req_failed:   ['rate<0.01'],  // < 1% errors
  },
}

export default function () {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `user${Math.floor(Math.random() * 1000)}@test.com`,
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } })

  check(loginRes, { 'login 200': r => r.status === 200 })
  sleep(1)
}
```

### Test Environment

```yaml
# tests/docker-compose.test.yml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: potok_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"  # different port to avoid conflicts

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
```

---

## 3. Performance Considerations

### API Latency Targets

| Endpoint | P50 | P95 | P99 |
|----------|:---:|:---:|:---:|
| POST /api/auth/login | 80ms | 180ms | 300ms |
| GET /api/accounts | 20ms | 50ms | 100ms |
| GET /api/inbox | 30ms | 80ms | 150ms |
| GET /api/campaigns/:id/stats | 50ms | 120ms | 200ms |
| POST /api/contacts/import (10k rows) | 2s | 8s | 15s |

### Database Optimizations

```sql
-- Hot query 1: Get running campaigns for scheduler (every minute)
-- Current: sequential scan on campaigns
-- Optimization:
CREATE INDEX idx_campaigns_running ON campaigns(status) WHERE status = 'running';
-- Result: index-only scan for running campaigns

-- Hot query 2: Inbox score calculation (warmup_events last 30 days)
-- Current: full scan on warmup_events per account
-- Optimization already in schema:
CREATE INDEX idx_warmup_events_account_date ON warmup_events(account_id, created_at DESC);
-- Result: index range scan, O(log n) lookup

-- Hot query 3: getPendingSends - complex join
-- Optimization: materialized view for campaign statistics (refresh every 5 min)
CREATE MATERIALIZED VIEW campaign_stats AS
  SELECT
    campaign_id,
    COUNT(*) FILTER (WHERE status = 'sent') as sent_count,
    COUNT(*) FILTER (WHERE status = 'replied') as reply_count,
    COUNT(*) FILTER (WHERE status = 'opened') as open_count,
    MAX(sent_at) as last_sent_at
  FROM email_sends
  GROUP BY campaign_id;
CREATE UNIQUE INDEX ON campaign_stats(campaign_id);

-- Refresh periodically
REFRESH MATERIALIZED VIEW CONCURRENTLY campaign_stats;

-- Hot query 4: Unsubscribe check before every email send
-- unsubscribes.email is PRIMARY KEY → O(log n), fast enough
-- No additional index needed
```

### BullMQ Tuning

```typescript
// Concurrency settings based on VPS capacity (4 CPU / 8GB RAM)
const WORKER_CONCURRENCY = {
  warmup:     10,  // IMAP is I/O bound, safe to parallelize
  emailSend:  20,  // SMTP is I/O bound
  inboxScan:   5,  // IMAP connections are expensive
  aiReply:     5,  // Claude API rate limited (1000 RPM)
  dnsCheck:   10,  // DNS lookups are fast
  billing:     1,  // Sequential to prevent race conditions
}

// Job options
const BASE_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 60_000 },
  removeOnComplete: { count: 1000 },  // keep last 1000 completed jobs
  removeOnFail: { count: 500 },       // keep last 500 failed for debugging
}

// Rate limiting per queue (not to overwhelm external services)
const RATE_LIMITERS = {
  warmup:    { max: 100, duration: 60_000 },  // 100 SMTP connections/min
  emailSend: { max: 200, duration: 60_000 },  // 200 emails/min
  inboxScan: { max:  30, duration: 60_000 },  // 30 IMAP sessions/min
  aiReply:   { max:  50, duration: 60_000 },  // 50 Claude API calls/min
}
```

### Next.js Caching Strategy

```typescript
// Landing page: ISR (regenerate every 5 min)
export const revalidate = 300  // seconds

// Dashboard data: no cache (real-time)
async function getAccounts() {
  return fetch('/api/accounts', { cache: 'no-store' })
}

// Inbox Score history: short cache (60 sec)
export async function generateMetadata({ params }) {
  return fetch(`/api/accounts/${params.id}/score`, {
    next: { revalidate: 60 }
  })
}

// Static assets: Cloudflare cache (1 week)
// next.config.js
headers: [
  {
    source: '/_next/static/:path*',
    headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, immutable' }]
  }
]
```

### Connection Pooling

```typescript
// Prisma: database connection pool
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  // PostgreSQL connection pool via connection_limit
  // DATABASE_URL: postgresql://user:pass@host/db?connection_limit=20&pool_timeout=20
})

// Redis: single client instance per process (not per request)
// apps/api/src/plugins/redis.plugin.ts
const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,  // fail fast if Redis is down
})

// imapflow: connection per job (IMAP doesn't support connection pooling)
// Close connections immediately after use to prevent connection leaks
```

---

## 4. Security Gap Analysis

| Gap | Severity | Status | Mitigation |
|-----|:--------:|--------|-----------|
| GDPR consent_log | HIGH | Not in MVP | Block EU user acquisition. Add `consent_log` table before opening EU registrations |
| YooKassa event deduplication | HIGH | In spec | `UNIQUE yookassa_event_id` in payment_events |
| ZIP bomb protection (CSV import) | MEDIUM | Not in MVP | Add file size check (≤10MB), stream-parse without full memory load |
| Warmup pattern detection by Yandex | MEDIUM | Mitigated | Human-like delays (random 30s–5min), subject line pool, daylight hours only |
| IMAP credential storage rotation | MEDIUM | Future | Key versioning for ENCRYPTION_KEY rotation (ADR needed) |
| Claude API proxy for RU IPs | MEDIUM | Architecture | Route Claude API calls through EU/US proxy or Cloudflare Worker |
| Rate limit bypass (IP rotation) | LOW | Mitigated | Cloudflare L7 challenge + account-level limits (not just IP) |
| Session fixation | LOW | Mitigated | New token pair issued on every login (no session reuse) |
| User enumeration via reset password | LOW | Mitigated | Always return 200 "если email существует, письмо отправлено" |
| Concurrent login race condition | LOW | Mitigated | bcrypt comparison always runs (constant time) |

### Security Checklist (pre-launch)

```
Authentication:
  ✓ bcrypt cost 12
  ✓ JWT 15min access + 7d refresh
  ✓ Redis blacklist on logout
  ✓ Constant-time comparison for passwords/tokens
  ✓ No user enumeration in login/register errors

Authorization:
  ✓ All DB queries filter by user_id
  ✓ Plan limits enforced server-side
  ✓ Webhook endpoints don't require auth (but signature-verified)

Input Validation:
  ✓ Zod on all API boundaries
  ✓ DOMPurify on campaign HTML before storage
  ✓ Email format validation at import
  ✓ File size limit on CSV upload

Secrets:
  ✓ Credentials encrypted AES-256-GCM
  ✓ All secrets in env vars
  ✓ .env in .gitignore
  ✓ No secrets in logs

Transport:
  ✓ TLS 1.2+ enforced (Nginx)
  ✓ HSTS header
  ✓ X-Frame-Options: DENY

Pre-launch blockers:
  ✗ Penetration test (before paying customers)
  ✗ GDPR consent_log (before EU acquisition)
  ✗ Bug bounty program setup
```

---

## 5. Known Limitations & Mitigations

### L1: Warmup Pool Cold Start

**Limitation:** При запуске (0 пользователей) warmup pool пустой → нельзя прогревать первых пользователей.

**Mitigation:**
- Купить 100 seed Яндекс аккаунтов (App Passwords) перед launch
- Seed аккаунты участвуют в пуле как "виртуальные партнёры"
- Стоимость: ~₽5,000 + ~₽1,000/мес на поддержание
- После набора 200 реальных пользователей seed аккаунты можно вывести из пула

### L2: Claude API Availability из РФ

**Limitation:** Anthropic API может ограничить доступ с RU IP-адресов.

**Mitigation:**
- Роутинг запросов к Claude API через Cloudflare Worker (EU PoP) или Hetzner EU VPS
- `apps/worker` → Cloudflare Worker proxy → `api.anthropic.com`
- Добавить health check на Claude API connectivity при старте worker

### L3: Яндекс Rate Limiting

**Limitation:** Яндекс ограничивает 200 писем/день с аккаунта. При агрессивном warmup → блокировка.

**Mitigation:**
- Строго следовать ramp-up стратегии (5→10→40→100→200)
- Random delays между отправками (30s–5min)
- Мониторинг bounce rate: если > 5% → автоматически снижать dailyLimit
- Не запускать warmup в ночные часы (только 08:00–22:00 МСК)

### L4: Масштабирование Warmup Pool

**Limitation:** При 1000 пользователей с 3 аккаунтами каждый = 3000 аккаунтов в пуле → 3000 IMAP соединений в час.

**Mitigation:**
- Worker concurrency для inboxScan = 5 → управляемая нагрузка
- Добавить второй worker контейнер при queue depth > 5000
- Приоритизация: новые аккаунты (первые 21 день) имеют priority: 1; maintenance аккаунты — priority: 2

### L5: PostgreSQL Single Node

**Limitation:** Нет replicas → любой downtime = полная недоступность.

**Mitigation (MVP):**
- Daily pg_dump → MinIO backup
- Docker restart policy: `unless-stopped`
- RTO < 2 часа (restore from backup)

**Mitigation (v1+):**
- PostgreSQL streaming replication → standby on second VPS
- Автоматический failover через patroni

### L6: Отсутствие Rate-Limit для BullMQ Jobs

**Limitation:** Spike нагрузки (1000 пользователей запускают warmup одновременно) = BullMQ queue глубина 100K+ jobs.

**Mitigation:**
- `QueueRateLimit` в BullMQ: `{ max: 100, duration: 60_000 }` для warmup queue
- Scheduler добавляет jobs постепенно (hourly), не все сразу
- Monitoring: alert если queue depth > 10,000

---

## 6. Error Handling Catalog

### HTTP Error Responses

```typescript
// Standard error response format
type ErrorResponse = {
  error: string        // machine-readable error code
  message: string      // human-readable (Russian)
  details?: unknown    // validation details for 400
}

// Error codes catalog
const ERROR_CODES = {
  // Auth (4xx)
  'invalid_credentials':    { status: 401, message: 'Неверный email или пароль' },
  'token_invalid':          { status: 401, message: 'Токен недействителен или истёк' },
  'token_expired':          { status: 401, message: 'Сессия истекла. Войдите снова.' },
  'email_taken':            { status: 409, message: 'Аккаунт с этим email уже существует' },
  'validation_error':       { status: 400, message: 'Ошибка валидации' },

  // Account (4xx)
  'plan_limit_exceeded':    { status: 403, message: 'Лимит аккаунтов по тарифу исчерпан' },
  'smtp_connection_failed': { status: 400, message: 'Не удалось подключиться к SMTP серверу' },
  'imap_connection_failed': { status: 400, message: 'Не удалось подключиться к IMAP серверу' },
  'account_not_found':      { status: 404, message: 'Аккаунт не найден' },

  // Campaign (4xx)
  'campaign_not_found':     { status: 404, message: 'Кампания не найдена' },
  'no_from_account':        { status: 400, message: 'Выберите аккаунт-отправитель' },
  'campaign_already_running':{ status: 409, message: 'Кампания уже запущена' },

  // Billing (4xx/5xx)
  'no_active_subscription': { status: 404, message: 'Активная подписка не найдена' },
  'invalid_webhook_sig':    { status: 401, message: 'Неверная подпись webhook' },
  'payment_failed':         { status: 402, message: 'Платёж не прошёл' },

  // Generic (5xx)
  'internal_error':         { status: 500, message: 'Внутренняя ошибка сервера' },
}
```

### Worker Error Handling

```typescript
// All workers use consistent error handling
worker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed`, {
    queue: worker.name,
    jobData: job.data,
    error: err.message,
    attempt: job.attemptsMade,
  })

  // Track in Prometheus
  metrics.increment('worker.job.failed', { queue: worker.name })

  // Alert on repeated failures
  if job.attemptsMade >= job.opts.attempts {
    alertService.notify(`Job permanently failed: ${worker.name}:${job.id}`)
  }
})

// Graceful shutdown (SIGTERM)
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, draining workers...')
  await Promise.all([
    warmupWorker.close(),
    emailSendWorker.close(),
    inboxScanWorker.close(),
    aiReplyWorker.close(),
  ])
  process.exit(0)
})
```

### IMAP Error Recovery

```typescript
// imapflow connection errors
async function connectImapWithRetry(creds, config, maxAttempts = 3): Promise<ImapFlow> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const client = new ImapFlow({ host: config.host, port: config.port, auth: creds, secure: true })
      await client.connect()
      return client
    } catch (err) {
      if (i === maxAttempts - 1) throw err
      await sleep(1000 * Math.pow(2, i))  // 1s, 2s, 4s
    }
  }
}

// Specific IMAP errors
const IMAP_AUTH_ERRORS = ['AUTHENTICATIONFAILED', 'LOGIN', 'NO']

function isAuthError(err: Error): boolean {
  return IMAP_AUTH_ERRORS.some(code => err.message.includes(code))
}

// If auth error → mark account as 'error', don't retry
if isAuthError(err) {
  await db.emailAccounts.update(accountId, { status: 'error' })
  await createAlert(accountId, 'imap_auth_failed', 'Проверьте App Password аккаунта')
  return  // don't throw — job completed successfully (by detecting error state)
}
```

# Validation Report — Поток

**Дата:** 2026-04-29 | **Итерация:** 1/3 | **Метод:** Swarm (5 параллельных агентов)

---

## Summary

| Агент | Область | Pre-fix | Post-fix | Status |
|-------|---------|---------|---------|--------|
| validator-stories | INVEST (17 user stories) | 73/100 | 77/100 | 🟡 CAVEATS |
| validator-acceptance | SMART (AC + security) | 76/100 | 82/100 | 🟡 CAVEATS |
| validator-architecture | Architecture.md | 88/100 | 95/100 | 🟢 READY |
| validator-pseudocode | Pseudocode.md | 72/100 | 82/100 | 🟡 CAVEATS |
| validator-coherence | Cross-doc consistency | 71/100 | 83/100 | 🟡 CAVEATS |
| **AVERAGE** | | **76/100** | **84/100** | **🟡 CAVEATS** |

**BLOCKED до фиксов:** 8 | **BLOCKED после:** 0
**Iterations used:** 1/3

---

## Verdict: 🟡 CAVEATS — READY TO PROCEED

> Все BLOCKED items устранены в Iteration 1. Средний балл 84/100 > 70. Оставшиеся предупреждения задокументированы. Реализация может начинаться.

---

## RESOLVED (Iteration 1 Fixes)

| # | Документ | Проблема | Исправление |
|---|---------|---------|------------|
| F1 | Specification.md | `email_sends.status` не содержал `skipped\|cancelled` | Добавлены оба значения в CHECK |
| F2 | Specification.md | `inbox_score_snapshots.provider DEFAULT 'yandex'` (несогласованность с Architecture.md) | Изменено на `DEFAULT 'combined'` |
| F3 | Specification.md | Отсутствовали 10 колонок в 4 таблицах (warmup_started_at, dns_*, ai_reply_*, renewal_*) | Все колонки добавлены |
| F4 | Specification.md | US-03 (password reset) — 0 Gherkin AC | Добавлен полный Gherkin (5 scenarios + API Contract) |
| F5 | Pseudocode.md | `senderAccount` не определена в `processWarmupSend()` — runtime crash | Добавлен `senderAccount = await db.emailAccounts.findById(job.accountId)` |
| F6 | Pseudocode.md | `refreshToken()` — P0 endpoint без pseudocode | Добавлена функция `POST /api/auth/refresh` |
| F7 | Pseudocode.md | `forgotPassword()` / `resetPassword()` отсутствовали | Добавлены обе функции с rate limit (3/hr) и single-use токеном |
| F8 | Pseudocode.md | Trial expiry logic обновлял `plan: 'trial'` вместо `'free'` | Исправлено на `plan: 'free'` |
| F9 | Pseudocode.md | Retry counter в `processRecurringBilling()` не персистировался при `>= 3` | Исправлено: `renewalAttempts` всегда сохраняется перед ветвлением |
| F10 | Pseudocode.md | `cancelSubscription()` не производил downgrade plan после окончания периода | Добавлен `downgradePlanQueue.add({ userId, newPlan: 'free' }, { delay })` |
| F11 | Architecture.md | Grafana expose port `"3000"` конфликтовал с API port | Исправлено на `"3002"` + `GF_SERVER_HTTP_PORT=3002` |
| F12 | Architecture.md | bcrypt cost factor 12 не упоминался в Security Architecture section | Добавлен явно: `bcrypt cost factor 12` + JWT TTL константы |

---

## Remaining Warnings (не блокируют реализацию)

### validator-stories — CAVEATS

| Story | Score | Issue |
|-------|-------|-------|
| US-05 | 58 | DNS Checker — нет standalone Gherkin AC. Вшит в US-04 сценарий. |
| US-08 | 67 | Score history chart — AC встроен в US-07 блок, не отдельный |
| US-09 | 58 | Score alert — канал доставки (Telegram "опционально") делает scope нечётким для sprint |
| US-12 | 58 | Pause/resume campaign — 0 Gherkin AC для BullMQ job state transitions |
| US-14 | 67 | Lead status tags — AC в блоке US-13, "Перезвонить" поведение не задано |
| US-16 | 58 | Invoice history — 0 Gherkin AC, InvoiceDTO не определён |
| US-17 | 67 | Cancel subscription — AC встроен в US-15, re-subscription path не описан |

**Рекомендация:** US-09, US-12, US-16 добавить в бэклог фиксов перед реализацией соответствующих фич.

### validator-acceptance — CAVEATS

| Issue | Risk | Action |
|-------|------|--------|
| YooKassa webhook: нет Gherkin AC для invalid signature → 401 | HIGH (payment security) | Добавить в test-scenarios.md как обязательный security scenario |
| Brute-force rate limit: нет 429 scenario для auth endpoint | MEDIUM | Добавить в test-scenarios.md |
| US-04: нет HTTP статуса в credential-fail scenario | LOW | Уточнить при реализации |
| US-06: "показывается предупреждение" — нет exact text | LOW | PM решает при реализации |
| Multi-tenant isolation: нет Gherkin для cross-user data access | MEDIUM | Добавлен в security scenarios |

### validator-pseudocode — CAVEATS (remaining)

| Issue | Severity | Status |
|-------|---------|--------|
| Inbox Score: per-provider (yandex/mailru/gmail) vs combined — Pseudocode.md использует combined, Spec.md говорит min(yandex,mailru,gmail) | MAJOR | Отложено до v1.0 — MVP использует combined score с `provider='combined'` |
| `getPendingSends()` — unbounded unsubscribe scan | MAJOR | Отмечено в Refinement.md как известное ограничение D4 |
| CSV import algorithm — нет pseudocode для US-11 | MAJOR | Добавить при реализации US-11 фичи |
| `JSON.parse` в `classifyReply()` без try/catch | MINOR | Исправить при реализации AI Reply |
| Unsubscribe token functions — referenced but not defined | MINOR | Реализовать с crypto.createHmac |

### validator-coherence — CAVEATS (remaining)

| Issue | Impact |
|-------|--------|
| Ramp-up description в Refinement.md: "5→10→40→100→200" — shorthand расходится с 4-tier ranges в Spec | LOW — не влияет на код |
| Trial plan limits (1 account, 1 campaign) заданы только в Pseudocode.md PLAN_LIMITS | LOW — задокументировано |
| InboxScoreCalculator cron не зарегистрирован в BullMQ setup block в Pseudocode.md §10 | MEDIUM — добавить при реализации |
| AI Reply Agent в SPARC docs описан как v1.0 в PRD, но включён в Spec/Pseudocode/Architecture | LOW — намеренно, позволяет реализовать частично в MVP |
| Completion.md roadmap M2–M3 vs PRD M4–M9 для AI Reply | LOW — Completion.md оптимистичен |

---

## INVEST Analysis Summary (17 stories)

| Story | Title | Score | Status |
|-------|-------|-------|--------|
| US-01 | Регистрация | 97 | ✅ READY |
| US-02 | Аутентификация | 88 | ✅ READY |
| US-03 | Сброс пароля | **85** | ✅ READY (fixed) |
| US-04 | Email Account Connect | 97 | ✅ READY |
| US-05 | DNS Checker | 58 | ⚠️ CAUTION |
| US-06 | Warmup Start | 88 | ✅ READY |
| US-07 | Inbox Score Dashboard | 97 | ✅ READY |
| US-08 | Score History Chart | 67 | ⚠️ CAUTION |
| US-09 | Score Alert <70% | 58 | ⚠️ CAUTION |
| US-10 | Campaign Builder | 88 | ✅ READY |
| US-11 | CSV Contact Import | 97 | ✅ READY |
| US-12 | Pause/Resume Campaign | 58 | ⚠️ CAUTION |
| US-13 | Unified Inbox | 88 | ✅ READY |
| US-14 | Lead Status Tags | 67 | ⚠️ CAUTION |
| US-15 | YooKassa Billing | 88 | ✅ READY |
| US-16 | Invoice History | 58 | ⚠️ CAUTION |
| US-17 | Cancel Subscription | 67 | ⚠️ CAUTION |

**READY:** 9 | **CAUTION:** 8 | **BLOCKED:** 0

---

## Security Coverage

| Control | Gherkin AC | Risk |
|---------|-----------|------|
| JWT TTL 15min/7d | ✅ US-01, US-02 | — |
| Redis blacklist on logout | ✅ US-02 | — |
| AES-256-GCM email creds | ✅ US-04 | — |
| bcrypt cost 12 | ✅ Architecture.md | — |
| YooKassa webhook HMAC | ⚠️ NFR only, no Gherkin | MEDIUM |
| Rate limit (429) | ⚠️ NFR only, no Gherkin | MEDIUM |
| Password reset: single-use token | ✅ US-03 (fixed) | — |
| Multi-tenant isolation | ⚠️ No Gherkin AC | MEDIUM |
| 38-ФЗ unsubscribe compliance | ✅ Pseudocode key invariants | — |

---

## Known Limitations (acceptable for MVP)

1. **Per-provider Inbox Score** (yandex/mailru/gmail split): MVP ships with `combined` score. Per-provider breakdown is a v1.0 feature. Spec.md updated to reflect this.
2. **CSV import pseudocode**: Algorithm to be written during feature implementation (US-11). Spec has full Gherkin AC.
3. **Telegram alerts** (US-09): Descoped from MVP to v1.0. In-platform notification only.
4. **AI Reply Agent**: PRD places it in v1.0, but architecture is scaffolded. Implementation gated behind feature flag `ai_reply_enabled`.

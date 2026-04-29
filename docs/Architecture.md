# Architecture: Поток

**Паттерн:** Distributed Monolith (Monorepo)
**Инфра:** Docker Compose на VPS (AdminVPS/HOSTKEY)
**Дата:** 2026-04-29

---

## Содержание

1. [C4 Level 1 — System Context](#1-c4-level-1--system-context)
2. [C4 Level 2 — Container Diagram](#2-c4-level-2--container-diagram)
3. [C4 Level 3 — Component Diagram (API)](#3-c4-level-3--component-diagram-api)
4. [Tech Stack Decisions (ADR)](#4-tech-stack-decisions-adr)
5. [Docker Compose](#5-docker-compose)
6. [Database Schema (DDL)](#6-database-schema-ddl)
7. [Security Architecture](#7-security-architecture)
8. [Network Architecture](#8-network-architecture)
9. [Data Flow Diagrams](#9-data-flow-diagrams)
10. [Deployment & Scaling](#10-deployment--scaling)

---

## 1. C4 Level 1 — System Context

```
┌──────────────────────────────────────────────────────────────────────┐
│                         SYSTEM CONTEXT                               │
│                                                                      │
│  ┌─────────────┐                     ┌──────────────────────────┐   │
│  │ SDR/Founder │────────────────────►│                          │   │
│  │  (Segment A)│  HTTPS / Browser    │        ПОТОК             │   │
│  └─────────────┘                     │   Cold Email Outreach    │   │
│                                      │     SaaS Platform        │   │
│  ┌─────────────┐                     │                          │   │
│  │   Agency    │────────────────────►│  apps/api  (Fastify)     │   │
│  │  (Segment B)│  HTTPS / Browser    │  apps/web  (Next.js)     │   │
│  └─────────────┘                     │  apps/worker (BullMQ)    │   │
│                                      └────────────┬─────────────┘   │
│  ┌─────────────┐                                  │                  │
│  │B2B SaaS Mkt │────────────────────►             │                  │
│  │  (Segment C)│  HTTPS / Browser                 │                  │
│  └─────────────┘                                  │                  │
│                                                   │                  │
└───────────────────────────────────────────────────┼──────────────────┘
                                                    │
          ┌─────────────────┬──────────────┬────────┴──────────┐
          ▼                 ▼              ▼                    ▼
   ┌─────────────┐  ┌─────────────┐  ┌──────────┐   ┌──────────────────┐
   │  Yandex.ru  │  │  Mail.ru    │  │  YooKassa│   │  Claude API      │
   │ SMTP/IMAP   │  │ SMTP/IMAP   │  │ Payments │   │ (Anthropic)      │
   └─────────────┘  └─────────────┘  └──────────┘   └──────────────────┘
          ▲                 ▲
   ┌─────────────┐  ┌─────────────┐
   │  Gmail      │  │  amoCRM     │  (v1.0)
   │ SMTP/IMAP   │  │  Bitrix24   │
   └─────────────┘  └─────────────┘
```

**Внешние системы:**

| Система | Тип | Назначение |
|---------|-----|-----------|
| Яндекс SMTP/IMAP | Email provider | Прогрев + кампании RU-рынка |
| Mail.ru SMTP/IMAP | Email provider | Прогрев + кампании RU-рынка |
| Gmail SMTP/IMAP | Email provider | Международные аккаунты |
| YooKassa | Payment gateway | Подписки, СБП, T-Pay |
| Claude API (Anthropic) | AI API | AI Reply Agent, классификация |
| amoCRM REST API v4 | CRM (v1.0) | Создание лидов из ответов |
| Bitrix24 REST API | CRM (v1.0) | Создание лидов из ответов |

---

## 2. C4 Level 2 — Container Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VPS (AdminVPS/HOSTKEY)                      │
│                          Ubuntu 22.04 LTS · Docker Compose               │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐     │
│  │                        Nginx (reverse proxy)                     │     │
│  │              :80 → redirect to :443 (TLS/SSL via Certbot)       │     │
│  │          /api/* → api:3000 | /* → web:3001                      │     │
│  └──────────────────────┬──────────────────────┬────────────────────┘     │
│                         │                      │                           │
│              ┌──────────▼──────────┐  ┌────────▼────────────┐            │
│              │   apps/api          │  │   apps/web           │            │
│              │   Fastify v5        │  │   Next.js 15         │            │
│              │   TypeScript        │  │   App Router         │            │
│              │   Port :3000        │  │   Port :3001         │            │
│              │                     │  │                       │            │
│              │  Routes:            │  │  Pages:               │            │
│              │  /api/auth          │  │  / (landing SSR)     │            │
│              │  /api/accounts      │  │  /dashboard (CSR)    │            │
│              │  /api/campaigns     │  │  /inbox (CSR)        │            │
│              │  /api/contacts      │  │  /billing (CSR)      │            │
│              │  /api/inbox         │  │  /onboarding (CSR)   │            │
│              │  /api/billing       │  └─────────────────────┘            │
│              └──────────┬──────────┘                                      │
│                         │                                                  │
│              ┌──────────▼──────────┐                                      │
│              │   apps/worker       │                                      │
│              │   BullMQ Workers    │                                      │
│              │   TypeScript        │                                      │
│              │                     │                                      │
│              │  Workers:           │                                      │
│              │  warmup-worker      │                                      │
│              │  email-send-worker  │                                      │
│              │  inbox-scan-worker  │                                      │
│              │  ai-reply-worker    │                                      │
│              │  billing-worker     │                                      │
│              └──────────┬──────────┘                                      │
│                         │                                                  │
│    ┌────────────────────┼────────────────────────────┐                   │
│    │                    │                            │                   │
│  ┌─▼──────────┐  ┌──────▼──────┐  ┌─────────────┐  │                   │
│  │ PostgreSQL  │  │  Redis 7    │  │    MinIO     │  │                   │
│  │    16       │  │             │  │ (S3-compat.) │  │                   │
│  │             │  │ - Job queue │  │             │  │                   │
│  │ - users     │  │ - JWT bl.   │  │ - CSV files  │  │                   │
│  │ - accounts  │  │ - rate lim. │  │ - exports    │  │                   │
│  │ - campaigns │  │ - sessions  │  │ - backups    │  │                   │
│  │ - contacts  │  │             │  │             │  │                   │
│  │ - inbox     │  └─────────────┘  └─────────────┘  │                   │
│  │ - billing   │                                      │                   │
│  └─────────────┘  ┌─────────────┐  ┌─────────────┐  │                   │
│                   │ Prometheus  │  │   Grafana    │  │                   │
│                   │  :9090      │  │    :3002     │  │                   │
│                   └─────────────┘  └─────────────┘  │                   │
│                                                      │                   │
└──────────────────────────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────┘

External:
  Cloudflare (DNS + DDoS + TLS) ───► Nginx :443
  YooKassa ───────────────────────► POST /api/billing/webhook
  Claude API ─────────────────────► apps/worker (ai-reply-worker)
  Yandex/Mail.ru/Gmail ───────────► apps/worker (warmup + inbox-scan)
```

---

## 3. C4 Level 3 — Component Diagram (API)

```
apps/api/src/
│
├── plugins/                     (Fastify plugins — зарегистрированы один раз)
│   ├── auth.plugin.ts           → JWT verify middleware, user inject into request
│   ├── db.plugin.ts             → Prisma client singleton
│   ├── redis.plugin.ts          → Redis client singleton
│   ├── rate-limit.plugin.ts     → 100/min anon, 1000/min auth (Redis sliding window)
│   └── metrics.plugin.ts        → Prometheus counter/histogram hooks
│
├── routes/                      (Route handlers — thin layer, delegate to services)
│   ├── auth.routes.ts           → /api/auth/*
│   ├── accounts.routes.ts       → /api/accounts/*
│   ├── campaigns.routes.ts      → /api/campaigns/*
│   ├── contacts.routes.ts       → /api/contacts/*
│   ├── inbox.routes.ts          → /api/inbox/*
│   └── billing.routes.ts        → /api/billing/*
│
├── services/                    (Business logic — stateless, independently testable)
│   ├── auth.service.ts          → register, login, logout, issueTokenPair
│   ├── account.service.ts       → connectAccount, startWarmup, stopWarmup
│   ├── dns.service.ts           → checkSpf, checkDkim, checkDmarc
│   ├── campaign.service.ts      → create, start, pause, getStats
│   ├── contact.service.ts       → import, list, upsert, unsubscribe
│   ├── inbox.service.ts         → list, markRead, setLeadStatus, reply
│   ├── billing.service.ts       → createCheckout, handleWebhook, cancel
│   └── ai-reply.service.ts      → classify, generateDraft, determineAction
│
├── schemas/                     (Zod schemas — source of truth for validation)
│   ├── auth.schemas.ts
│   ├── account.schemas.ts
│   ├── campaign.schemas.ts
│   ├── contact.schemas.ts
│   └── billing.schemas.ts
│
└── lib/
    ├── crypto.ts                → encryptAES256GCM, decryptAES256GCM
    ├── mailer.ts                → sendSmtp (Nodemailer wrapper)
    ├── imap.ts                  → connectImap, search, move, markRead (imapflow wrapper)
    ├── bullmq.ts                → queue definitions, job helpers
    └── errors.ts                → typed error classes (NotFound, Forbidden, Conflict...)
```

---

## 4. Tech Stack Decisions (ADR)

### ADR-001: Fastify вместо Express

**Статус:** Accepted

**Контекст:** Нужен HTTP-фреймворк для API с высокой производительностью — warmup engine создаёт тысячи фоновых задач, API должен оставаться отзывчивым.

**Решение:** Fastify v5

**Обоснование:**
- 2× быстрее Express в бенчмарках (50k+ req/s vs 25k)
- Встроенная schema validation через JSON Schema → автодокументация
- Plugin system с dependency injection → testability
- TypeScript-first — full type safety из коробки
- `fastify-sensible`, `@fastify/rate-limit`, `@fastify/multipart` — зрелая экосистема

**Последствия:** Нестандартный async error handling (`reply.send()` обязателен). Обучение команды.

---

### ADR-002: Next.js 15 App Router

**Статус:** Accepted

**Контекст:** Нужен фреймворк для лендинга (SEO-критично) и dashboard (SPA). Два разных режима рендеринга в одном приложении.

**Решение:** Next.js 15 с App Router

**Обоснование:**
- SSR для лендинга → SEO (LCP < 1.5s = Google ranking фактор)
- RSC (React Server Components) — нет client-side waterfall для публичных страниц
- Route groups: `(public)` для SSR, `(dashboard)` для CSR
- `generateMetadata()` — автоматический SEO meta для каждой страницы
- Единый репозиторий — нет CORS между web и api (api — отдельный контейнер)

**Последствия:** Нельзя использовать `useState`/`useEffect` в Server Components. `'use client'` директива на компонентах с интерактивностью.

---

### ADR-003: PostgreSQL 16 + Prisma ORM

**Статус:** Accepted

**Контекст:** ACID транзакции критичны для billing. Multi-tenant данные требуют строгой изоляции.

**Решение:** PostgreSQL 16 + Prisma 5

**Обоснование:**
- ACID + JSONB для `custom_vars` контактов — гибкость без NoSQL
- Prisma: type-safe queries, автоматические миграции, `prisma.$transaction()` для billing
- Row-level isolation через `WHERE user_id = $1` на всех queries
- PostgreSQL 16: logical replication для будущего read replica
- Индексы на горячих путях (`account_id + created_at`, `user_id + is_read`)

**Последствия:** Prisma добавляет ~30ms overhead на холодный start. Компенсируется connection pooling.

---

### ADR-004: BullMQ + Redis 7

**Статус:** Accepted

**Контекст:** Warmup engine отправляет тысячи SMTP/IMAP запросов. Email send — конкурентные задачи с retry logic. Cron-джобы (hourly inbox score, daily billing).

**Решение:** BullMQ + Redis 7

**Обоснование:**
- Persistent queues (Redis AOF) — задачи не теряются при рестарте worker
- Concurrency control — `{ concurrency: 10 }` для warmup, `{ concurrency: 20 }` для email send
- Built-in retry с exponential backoff — SMTP временные ошибки автоматически ретраятся
- BullMQ `repeat` — built-in cron без отдельного cron-сервиса
- bull-board — встроенный UI для мониторинга очередей

**Последствия:** Redis — single point of failure. Митигация: Redis AOF persistence + автоматический restart.

---

### ADR-005: imapflow для IMAP

**Статус:** Accepted

**Контекст:** Нужна надёжная IMAP библиотека для Node.js — чтение входящих, перемещение из спама, поддержка Яндекс/Mail.ru.

**Решение:** imapflow (npm)

**Обоснование:**
- Единственная современная IMAP библиотека с async/await API
- Поддерживает IMAP4rev2, IDLE (push уведомления)
- Работает с Яндекс IMAP (imap.yandex.com:993) без патчей
- Активная поддержка (2024 releases)
- `imapflow.getMailboxLock()` — предотвращает concurrent access конфликты

**Альтернативы отклонены:** `node-imap` (callback hell, не поддерживается), `imap-simple` (обёртка над node-imap).

---

### ADR-006: Claude API для AI Reply Agent

**Статус:** Accepted

**Контекст:** Нужен LLM для классификации входящих и генерации ответов на русском языке.

**Решение:** `claude-sonnet-4-6` (Anthropic API)

**Обоснование:**
- Лучшее качество текста на русском языке среди доступных моделей
- Достаточно дешевле Opus для production-нагрузки (classification + short drafts)
- Низкая латентность (<2s для 500 токенов) → приемлемо для draft generation
- Anthropic API стабильна, есть TypeScript SDK

**Ограничения:** Anthropic API может быть недоступна из RU IP. Решение: проксировать через EU/US VPS или использовать Cloudflare Worker как прокси.

---

### ADR-007: YooKassa вместо Stripe

**Статус:** Accepted

**Контекст:** Stripe недоступен для RU-юрлиц и RU-пользователей (карты заблокированы).

**Решение:** YooKassa + `yookassa-ts` TypeScript SDK

**Обоснование:**
- Единственный PCI DSS L1 gateway, доступный в РФ с 2026
- Поддержка: банковские карты, СБП, T-Pay, ЮMoney
- `yookassa-ts` — zero-deps TypeScript SDK, полные типы
- Webhooks совместимы с нашей архитектурой (signature verification)
- Рекуррентные платежи через `save_payment_method: true`

---

## 5. Docker Compose

```yaml
# docker-compose.yml
version: "3.9"

services:
  # ─── NGINX (reverse proxy + TLS) ───────────────────────────────────
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - certbot_certs:/etc/letsencrypt:ro
      - certbot_www:/var/www/certbot:ro
    depends_on:
      - api
      - web
    restart: unless-stopped
    networks:
      - potok_net

  # ─── CERTBOT (TLS certificates) ────────────────────────────────────
  certbot:
    image: certbot/certbot:latest
    volumes:
      - certbot_certs:/etc/letsencrypt
      - certbot_www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done'"
    restart: unless-stopped

  # ─── API (Fastify) ──────────────────────────────────────────────────
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      YOOKASSA_SHOP_ID: ${YOOKASSA_SHOP_ID}
      YOOKASSA_SECRET_KEY: ${YOOKASSA_SECRET_KEY}
      YOOKASSA_WEBHOOK_SECRET: ${YOOKASSA_WEBHOOK_SECRET}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      MINIO_ENDPOINT: minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      APP_URL: ${APP_URL}
    expose:
      - "3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - potok_net
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ─── WEB (Next.js) ──────────────────────────────────────────────────
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      NEXT_PUBLIC_API_URL: ${APP_URL}/api
      NEXT_PUBLIC_APP_URL: ${APP_URL}
    expose:
      - "3001"
    depends_on:
      - api
    restart: unless-stopped
    networks:
      - potok_net

  # ─── WORKER (BullMQ) ────────────────────────────────────────────────
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      YOOKASSA_SHOP_ID: ${YOOKASSA_SHOP_ID}
      YOOKASSA_SECRET_KEY: ${YOOKASSA_SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - potok_net

  # ─── POSTGRESQL ─────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    expose:
      - "5432"
    restart: unless-stopped
    networks:
      - potok_net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ─── REDIS ──────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    expose:
      - "6379"
    restart: unless-stopped
    networks:
      - potok_net
    healthcheck:
      test: ["CMD", "redis-cli", "--pass", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # ─── MINIO (S3-compatible storage) ──────────────────────────────────
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    expose:
      - "9000"
      - "9001"
    restart: unless-stopped
    networks:
      - potok_net

  # ─── PROMETHEUS ─────────────────────────────────────────────────────
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    expose:
      - "9090"
    restart: unless-stopped
    networks:
      - potok_net

  # ─── GRAFANA ────────────────────────────────────────────────────────
  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
      GF_SERVER_ROOT_URL: ${APP_URL}/grafana
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/dashboards:ro
    expose:
      - "3000"
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - potok_net

volumes:
  postgres_data:
  redis_data:
  minio_data:
  prometheus_data:
  grafana_data:
  certbot_certs:
  certbot_www:

networks:
  potok_net:
    driver: bridge
```

### Nginx Config

```nginx
# nginx/conf.d/potok.conf
server {
    listen 80;
    server_name app.поток.ru;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name app.поток.ru;

    ssl_certificate     /etc/letsencrypt/live/app.поток.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.поток.ru/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # API → Fastify
    location /api/ {
        proxy_pass         http://api:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        client_max_body_size 50M;  # для CSV импорта
    }

    # Frontend → Next.js
    location / {
        proxy_pass         http://web:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 6. Database Schema (DDL)

```sql
-- extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ─── USERS ───────────────────────────────────────────────────────────
CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  full_name           TEXT,
  plan                TEXT NOT NULL DEFAULT 'trial'
                      CHECK (plan IN ('trial','starter','pro','agency')),
  trial_ends_at       TIMESTAMPTZ,
  ai_reply_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
  ai_reply_mode       TEXT NOT NULL DEFAULT 'draft'
                      CHECK (ai_reply_mode IN ('autopilot','draft','manual')),
  ai_confidence_threshold INT NOT NULL DEFAULT 85,
  last_scanned_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EMAIL ACCOUNTS ──────────────────────────────────────────────────
CREATE TABLE email_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL,
  display_name      TEXT,
  smtp_host         TEXT NOT NULL,
  smtp_port         INT NOT NULL DEFAULT 465,
  imap_host         TEXT NOT NULL,
  imap_port         INT NOT NULL DEFAULT 993,
  credentials_enc   BYTEA NOT NULL,  -- AES-256-GCM
  status            TEXT NOT NULL DEFAULT 'connected'
                    CHECK (status IN ('connected','warming','paused','error')),
  inbox_score       INT NOT NULL DEFAULT 0 CHECK (inbox_score BETWEEN 0 AND 100),
  daily_limit       INT NOT NULL DEFAULT 50,
  in_warmup_pool    BOOLEAN NOT NULL DEFAULT FALSE,
  warmup_started_at TIMESTAMPTZ,
  last_scanned_at   TIMESTAMPTZ,
  dns_spf           BOOLEAN,
  dns_dkim          BOOLEAN,
  dns_dmarc         BOOLEAN,
  dns_checked_at    TIMESTAMPTZ,
  renewal_attempts  INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX idx_email_accounts_warmup ON email_accounts(in_warmup_pool, status)
  WHERE in_warmup_pool = TRUE AND status = 'warming';

-- ─── WARMUP EVENTS ───────────────────────────────────────────────────
CREATE TABLE warmup_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL
                  CHECK (event_type IN ('sent','received','moved_from_spam','opened','replied')),
  partner_account TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warmup_events_account_date ON warmup_events(account_id, created_at DESC);
-- Partition by month for large datasets (future)

-- ─── INBOX SCORE SNAPSHOTS ───────────────────────────────────────────
CREATE TABLE inbox_score_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  score          INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  provider       TEXT NOT NULL DEFAULT 'combined',
  snapshotted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_score_snapshots_account ON inbox_score_snapshots(account_id, snapshotted_at DESC);

-- ─── CAMPAIGNS ───────────────────────────────────────────────────────
CREATE TABLE campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','running','paused','completed')),
  from_account_id  UUID REFERENCES email_accounts(id) ON DELETE SET NULL,
  schedule_days    TEXT[] NOT NULL DEFAULT ARRAY['mon','tue','wed','thu','fri'],
  schedule_start   TIME NOT NULL DEFAULT '09:00',
  schedule_end     TIME NOT NULL DEFAULT '18:00',
  timezone         TEXT NOT NULL DEFAULT 'Europe/Moscow',
  daily_limit      INT NOT NULL DEFAULT 50,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user ON campaigns(user_id);
CREATE INDEX idx_campaigns_running ON campaigns(status) WHERE status = 'running';

-- ─── CAMPAIGN STEPS (sequence) ───────────────────────────────────────
CREATE TABLE campaign_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_number  INT NOT NULL CHECK (step_number > 0),
  subject      TEXT NOT NULL,
  body_html    TEXT NOT NULL,
  delay_days   INT NOT NULL DEFAULT 0 CHECK (delay_days >= 0),
  UNIQUE (campaign_id, step_number)
);

-- ─── CONTACTS ────────────────────────────────────────────────────────
CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  company     TEXT,
  position    TEXT,
  custom_vars JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active','unsubscribed','bounced')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

CREATE INDEX idx_contacts_user_status ON contacts(user_id, status);

-- ─── GLOBAL UNSUBSCRIBE LIST ─────────────────────────────────────────
CREATE TABLE unsubscribes (
  email            TEXT PRIMARY KEY,
  reason           TEXT CHECK (reason IN ('link','bounce','spam_complaint','manual')),
  unsubscribed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EMAIL SENDS ─────────────────────────────────────────────────────
CREATE TABLE email_sends (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_id      UUID NOT NULL REFERENCES campaign_steps(id),
  contact_id   UUID NOT NULL REFERENCES contacts(id),
  account_id   UUID NOT NULL REFERENCES email_accounts(id),
  status       TEXT NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued','sent','delivered','opened','replied','bounced','skipped','cancelled')),
  message_id   TEXT,
  opened_at    TIMESTAMPTZ,
  replied_at   TIMESTAMPTZ,
  bounced_at   TIMESTAMPTZ,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, step_id, contact_id)  -- prevent duplicate sends
);

CREATE INDEX idx_email_sends_campaign_status ON email_sends(campaign_id, status);
CREATE INDEX idx_email_sends_account_date ON email_sends(account_id, sent_at);
CREATE INDEX idx_email_sends_contact ON email_sends(contact_id);

-- ─── INBOX MESSAGES ──────────────────────────────────────────────────
CREATE TABLE inbox_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id    UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  send_id       UUID REFERENCES email_sends(id) ON DELETE SET NULL,
  from_email    TEXT NOT NULL,
  from_name     TEXT,
  subject       TEXT,
  body_text     TEXT,
  body_html     TEXT,
  is_read       BOOLEAN NOT NULL DEFAULT FALSE,
  lead_status   TEXT CHECK (lead_status IN ('interested','not_interested','callback','spam')),
  ai_draft      TEXT,
  ai_category   TEXT,
  ai_confidence INT CHECK (ai_confidence BETWEEN 0 AND 100),
  ai_sent_at    TIMESTAMPTZ,
  message_id    TEXT,  -- IMAP Message-ID for dedup
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inbox_user_read ON inbox_messages(user_id, is_read, received_at DESC);
CREATE INDEX idx_inbox_account ON inbox_messages(account_id, received_at DESC);
CREATE UNIQUE INDEX idx_inbox_message_id ON inbox_messages(account_id, message_id)
  WHERE message_id IS NOT NULL;

-- ─── SUBSCRIPTIONS ───────────────────────────────────────────────────
CREATE TABLE subscriptions (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                      UUID NOT NULL REFERENCES users(id),
  plan                         TEXT NOT NULL CHECK (plan IN ('starter','pro','agency')),
  status                       TEXT NOT NULL CHECK (status IN ('active','cancelled','past_due')),
  yookassa_payment_id          TEXT,
  yookassa_payment_method_id   TEXT,
  amount                       INT NOT NULL,
  billing_period               TEXT NOT NULL DEFAULT 'monthly',
  current_period_start         TIMESTAMPTZ,
  current_period_end           TIMESTAMPTZ,
  cancelled_at                 TIMESTAMPTZ,
  renewal_attempts             INT NOT NULL DEFAULT 0,
  renewal_attempt_at           TIMESTAMPTZ,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)  -- one active subscription per user
);

-- ─── PAYMENT EVENTS (audit log) ──────────────────────────────────────
CREATE TABLE payment_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id),
  event_type         TEXT NOT NULL,
  yookassa_event_id  TEXT UNIQUE,
  amount             INT,
  payload            JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── INBOX ALERTS ────────────────────────────────────────────────────
CREATE TABLE inbox_alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  alert_type  TEXT NOT NULL,  -- dmarc_missing|score_drop|smtp_error
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── TRIGGERS: updated_at ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 7. Security Architecture

### Authentication Flow

```
Browser                    Nginx                 Fastify API              Redis
  │                          │                       │                      │
  │──POST /api/auth/login────►│──────────────────────►│                      │
  │                          │                       │──bcrypt.compare()    │
  │                          │                       │──issueTokenPair()    │
  │                          │                       │──SET refresh:uid:tok─►│
  │◄─200 {access,refresh}────│◄──────────────────────│                      │
  │                          │                       │                      │
  │──GET /api/accounts───────►│──────────────────────►│                      │
  │  Authorization: Bearer   │                       │──jwt.verify(token)   │
  │                          │                       │──GET refresh:uid:tok─►│ (blacklist check on refresh)
  │◄─200 {accounts}──────────│◄──────────────────────│                      │
```

### Secrets Architecture

```
docker-compose.yml  →  ${ENV_VAR}  →  .env (never committed)
                                        ├── JWT_SECRET (256-bit random)
                                        ├── JWT_REFRESH_SECRET (256-bit random)
                                        ├── ENCRYPTION_KEY (32-byte AES key)
                                        ├── YOOKASSA_SECRET_KEY
                                        ├── YOOKASSA_WEBHOOK_SECRET
                                        ├── ANTHROPIC_API_KEY
                                        ├── POSTGRES_PASSWORD
                                        └── REDIS_PASSWORD

Email Credentials Storage:
  input.password  →  AES-256-GCM(ENCRYPTION_KEY)  →  credentials_enc (BYTEA in DB)
                  ← decrypt on demand ←

NEVER:
  ✗ Store passwords in plaintext
  ✗ Log credentials (middleware strips Authorization header from logs)
  ✗ Return credentials in API responses
  ✗ Commit .env files
```

### Rate Limiting Architecture

```
Layer 1: Cloudflare (DDoS, bot filtering)
         → Blocks obvious attack traffic before VPS

Layer 2: Nginx (connection limiting)
         limit_req_zone $binary_remote_addr zone=api:10m rate=200r/m;

Layer 3: Fastify (@fastify/rate-limit + Redis)
         Anonymous: 100 req/min per IP (Redis sliding window)
         Authenticated: 1000 req/min per user_id
         AI generation: 10 req/hr per user_id (separate bucket)
         Billing: 5 req/min per user (webhook replay protection)
```

### Input Validation Security

```typescript
// Every route uses Zod schema — no raw req.body ever
const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
})

// Route handler
async function login(req, reply) {
  const body = loginSchema.parse(req.body)  // throws ZodError if invalid
  // ...
}

// HTML content: DOMPurify BEFORE storage
const safeHtml = DOMPurify.sanitize(req.body.bodyHtml, {
  ALLOWED_TAGS: ['p','br','strong','em','a','ul','ol','li','h1','h2','h3'],
  ALLOWED_ATTR: ['href','target'],
})

// Rendering received email body: iframe sandbox (NOT innerHTML)
// <iframe srcdoc={rawHtml} sandbox="allow-same-origin" />
```

### Webhook Security

```typescript
// YooKassa webhook — verify BEFORE any processing
function verifyYooKassaSignature(rawBody: Buffer, signature: string): boolean {
  const expectedSig = crypto
    .createHmac('sha256', YOOKASSA_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  // Constant-time comparison (prevents timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  )
}

// Always use raw Buffer body — never parsed JSON for signature check
fastify.addContentTypeParser('application/json',
  { parseAs: 'buffer' },
  (req, body, done) => done(null, body)
)
```

---

## 8. Network Architecture

```
Internet
    │
    ▼
Cloudflare (DNS: app.поток.ru → VPS IP)
    │  DDoS protection, TLS termination optional
    │
    ▼
VPS: Ubuntu 22.04 LTS
    │  UFW: allow 80, 443 only. Block all else.
    │  SSH: key-based only, port 2222 (non-standard)
    │
    ▼
Docker network: potok_net (172.20.0.0/16)
    │
    ├── nginx:443 ──── api:3000 (internal)
    │              └── web:3001 (internal)
    │
    ├── api:3000 ───── postgres:5432 (internal)
    │              ├── redis:6379 (internal)
    │              └── minio:9000 (internal)
    │
    └── worker ──────── postgres:5432 (internal)
                   ├── redis:6379 (internal)
                   ├── smtp.yandex.com:465 (external)
                   ├── imap.yandex.com:993 (external)
                   └── api.anthropic.com (external)

Internal-only: postgres, redis, minio, prometheus, grafana
External-facing: nginx only (:80, :443)
```

---

## 9. Data Flow Diagrams

### Warmup Flow

```
[Scheduler cron/hr] → BullMQ warmup queue
                              │
                    [warmup-worker picks job]
                              │
                    [decrypt sender creds]
                              │
                    [Nodemailer] ──SMTP──► smtp.yandex.com ──► partner inbox
                              │
                    [sleep 30s–5min]
                              │
                    [imapflow] ──IMAP──► imap.yandex.com
                              │
                    [in inbox?] ──YES──► mark read → record 'received'
                              │                            │
                              │──NO───► check spam         │ 15% chance
                              │         │                  ▼
                              │         └─► move to inbox reply via SMTP
                              │             record 'moved_from_spam'
                              │
                    [DB: warmup_events ← INSERT]
                              │
                    [InboxScoreCalc/hr] ─► recalculate score ─► UPDATE email_accounts
```

### Campaign Send Flow

```
[Scheduler cron/min] ─► find running campaigns
                               │
                    [schedule window check]
                               │
                    [daily limit check]
                               │
                    [getPendingSends] ─► DB query
                               │
                    [substituteVariables] + [appendUnsubscribeLink]
                               │
                    [BullMQ email-send queue] ─► email-send-worker
                               │
                    [decrypt sender creds]
                               │
                    [check global unsubscribes]
                               │
                    [Nodemailer SMTP] ──► recipient's ESP
                               │
                    [UPDATE email_sends: sent_at, message_id]
```

### AI Reply Flow

```
[inbox-scan-worker/5min]
    │
    [imapflow] ──IMAP──► scan for new messages
    │
    [save to inbox_messages]
    │
    [user.plan in [pro,agency] && ai_reply_enabled?]
    │──YES──► enqueue ai-reply job
    │
    [ai-reply-worker]
    │
    [classifyReply()] ──► Claude API ──► { category, confidence }
    │
    [determineAction(mode, threshold, category)]
    │
    ├──'stop_sequence'──► cancel queued sends + unsubscribe contact
    ├──'postpone'───────► shift next follow-up +3 days
    ├──'autopilot'──────► generateAIReply() ─► Claude API ─► sendReply()
    └──'draft'──────────► save ai_draft ─► user sees in Inbox UI
```

---

## 10. Deployment & Scaling

### Initial Deploy (VPS, 4 CPU / 8GB RAM)

```bash
# First deployment
git clone git@github.com:SultankaReal/instantly-ai.git /opt/potok
cd /opt/potok
cp .env.example .env
# Edit .env with production values

docker compose pull
docker compose up -d postgres redis  # wait for health
docker compose run --rm api npx prisma migrate deploy
docker compose up -d
```

### Zero-Downtime Update

```bash
# Update strategy (rolling)
git pull origin main
docker compose build api web worker
docker compose up -d --no-deps api  # restart only api, no downtime
docker compose up -d --no-deps web
docker compose up -d --no-deps worker
```

### Scaling Strategy

| Threshold | Action | Cost |
|-----------|--------|------|
| API > 80% CPU | Scale API vertically (VPS upgrade) | +₽2,000/мес |
| Worker queue depth > 10k | Add worker replica (`--scale worker=2`) | +₽0 (same VPS) |
| PostgreSQL > 500 concurrent | Add PgBouncer | +₽0 (same VPS) |
| > 1000 concurrent users | Migrate to 2 VPS (API + DB/Redis) | +₽5,000/мес |
| > 5000 concurrent users | Kubernetes (separate ADR needed) | + |

### Backup Strategy

```
PostgreSQL: pg_dump daily → compress → upload to MinIO → retain 30 days
Redis: AOF persistence (appendonly yes) → data survives restart
MinIO: sync to second VPS or S3-compatible (Selectel Object Storage)

Recovery:
  RTO (Recovery Time Objective): < 2 hours
  RPO (Recovery Point Objective): < 15 minutes of data
```

### Monitoring Dashboards (Grafana)

```
Dashboard 1: System Health
  - CPU/Memory/Disk per container
  - PostgreSQL connections active
  - Redis memory usage

Dashboard 2: Warmup Performance
  - Warmup jobs/hr (success vs fail)
  - Inbox Score distribution (P25/P50/P75)
  - Pool size over time

Dashboard 3: Campaign Performance
  - Email sends/hr
  - Bounce rate (alert > 5%)
  - Reply rate
  - Queue depth

Dashboard 4: Business Metrics
  - MRR (from billing events)
  - New signups/day
  - Trial → Paid conversion
  - Churn events

Alert rules:
  ✗ API error rate > 5% → PagerDuty
  ✗ Queue depth > 10,000 jobs → Slack
  ✗ Bounce rate > 5% → Email to admin
  ✗ Disk > 80% → Slack
```

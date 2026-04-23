# Architecture: Inkflow
**Дата:** 2026-04-23 | **Pattern:** Distributed Monolith (Monorepo) | **Infra:** VPS (Docker Compose)

---

## 1. Architecture Style

**Pattern:** Distributed Monolith в Monorepo

**Обоснование:**
- Единая кодовая база → проще рефакторинг, нет distributed transactions overhead
- Независимые процессы (API, Worker, Frontend) → горизонтальное масштабирование при необходимости
- Docker Compose оркестрация → соответствует VPS-constraint без Kubernetes
- При росте → каждый service легко извлекается в самостоятельный микросервис (strangler fig pattern)

---

## 2. High-Level System Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        BR[Browser\nNext.js App]
        CR[Crawler\nGooglebot]
    end

    subgraph "Edge Layer"
        CF[Cloudflare CDN\nDDoS + Static Cache]
        NG[Nginx Reverse Proxy\nTLS + Load Balance]
    end

    subgraph "Application Layer (VPS)"
        API[API Service\nFastify + Node.js]
        WEB[Web Service\nNext.js SSR]
        WRK[Worker Service\nBullMQ Workers]
    end

    subgraph "Data Layer (VPS)"
        PG[(PostgreSQL 16\nPrimary DB)]
        RD[(Redis 7\nCache + Queue)]
        MN[(MinIO\nFile Storage)]
    end

    subgraph "External Services"
        PM[Postmark\nEmail Delivery]
        RS[Resend\nEmail Fallback]
        ST[Stripe\nPayments Global]
        CP[CloudPayments\nPayments RU]
        CL[Claude API\nAI via MCP]
    end

    subgraph "Observability"
        PR[Prometheus\nMetrics]
        GF[Grafana\nDashboards]
        SN[Sentry\nError Tracking]
    end

    BR --> CF
    CR --> CF
    CF --> NG
    NG --> API
    NG --> WEB
    API --> PG
    API --> RD
    API --> MN
    API --> ST
    API --> CP
    API --> CL
    WEB --> API
    WRK --> RD
    WRK --> PG
    WRK --> PM
    WRK --> RS
    API --> PR
    WEB --> PR
    WRK --> PR
    PR --> GF
    API --> SN
```

---

## 3. C4 Diagrams

### Level 1: System Context

```mermaid
C4Context
    title System Context — Inkflow

    Person(author, "Newsletter Author", "Creates and sends newsletters, manages subscribers")
    Person(reader, "Reader/Subscriber", "Subscribes to newsletters, pays for premium content")
    Person(admin, "Platform Admin", "Manages platform, moderates content")

    System(inkflow, "Inkflow", "Newsletter publishing platform with email delivery, paid subscriptions, SEO-native posts")

    System_Ext(stripe, "Stripe", "Payment processing (global)")
    System_Ext(cloudpayments, "CloudPayments", "Payment processing (RU market)")
    System_Ext(postmark, "Postmark", "Transactional email delivery")
    System_Ext(claude, "Claude API", "AI writing assistant")
    System_Ext(google, "Google", "SEO indexing and organic search")
    System_Ext(cloudflare, "Cloudflare", "CDN, DDoS protection, DNS")

    Rel(author, inkflow, "Writes posts, manages subscribers", "HTTPS")
    Rel(reader, inkflow, "Subscribes, reads, pays", "HTTPS")
    Rel(admin, inkflow, "Manages platform", "HTTPS")
    Rel(inkflow, stripe, "Processes payments", "HTTPS API")
    Rel(inkflow, cloudpayments, "Processes RU payments", "HTTPS API")
    Rel(inkflow, postmark, "Sends emails", "HTTPS API")
    Rel(inkflow, claude, "Generates drafts", "HTTPS MCP")
    Rel(google, inkflow, "Crawls SSR pages", "HTTPS")
    Rel(cloudflare, inkflow, "Proxies traffic", "HTTPS")
```

### Level 2: Container Diagram

```mermaid
C4Container
    title Container Diagram — Inkflow

    Person(author, "Author")
    Person(reader, "Reader")

    Container(web, "Web App", "Next.js 15 SSR", "Public posts, author dashboard, subscription UI")
    Container(api, "API Server", "Fastify + TypeScript", "REST API, auth, business logic")
    Container(worker, "Email Worker", "BullMQ + Node.js", "Async email delivery jobs")
    ContainerDb(pg, "PostgreSQL", "PostgreSQL 16", "Users, posts, subscribers, payments")
    ContainerDb(redis, "Redis", "Redis 7", "Sessions, rate limits, job queue")
    ContainerDb(minio, "Object Storage", "MinIO", "Images, CSV uploads, email attachments")

    Rel(author, web, "Manages newsletter", "HTTPS")
    Rel(reader, web, "Reads posts, subscribes", "HTTPS")
    Rel(web, api, "API calls", "HTTP/JSON")
    Rel(api, pg, "Reads/writes data", "TCP")
    Rel(api, redis, "Sessions, cache, rate limits", "TCP")
    Rel(api, minio, "Stores/retrieves files", "S3 API")
    Rel(api, redis, "Enqueues email jobs", "TCP")
    Rel(worker, redis, "Dequeues jobs", "TCP")
    Rel(worker, pg, "Updates send status", "TCP")
```

---

## 4. Service Breakdown

### 4.1 API Service (`apps/api`)

**Runtime:** Node.js 20 LTS + TypeScript 5.x + Fastify 4.x

| Responsibility | Details |
|---------------|---------|
| Authentication | JWT (access 15min + refresh 7d) + bcrypt password hashing |
| Publications CRUD | Create, update, publish settings, custom domain |
| Posts CRUD | Draft, schedule, send, analytics |
| Subscriber management | Import, unsubscribe, segments |
| Payment webhooks | Stripe + CloudPayments event handlers |
| Email job enqueueing | Validates → creates EmailSend records → pushes to BullMQ |
| AI proxy | Forwards draft generation requests to Claude API via MCP |
| Rate limiting | Redis sliding window (100/min anon, 1000/min auth) |

**Port:** 3001 (internal only, behind Nginx)

### 4.2 Web Service (`apps/web`)

**Runtime:** Next.js 15 (App Router) + TypeScript 5.x + Tailwind CSS 3.x

| Route | Rendering | Purpose |
|-------|-----------|---------|
| `/dashboard/**` | CSR (Client) | Author dashboard — editor, analytics, settings |
| `/[slug]` | SSR | Publication homepage |
| `/[slug]/posts/[id]` | SSR | Individual post page (SEO target) |
| `/[slug]/subscribe` | SSR | Subscription form |
| `/api/**` | Next.js Route Handlers | Thin proxy to API service |

**SEO Strategy:**
- `generateMetadata()` per post page → dynamic title/description/OG
- `generateStaticParams()` for recently active publications → ISR with 5min revalidation
- `sitemap.xml` via Next.js sitemap route → regenerated on post publish
- `robots.txt` → allows all crawlers on public posts

**Port:** 3000 (exposed via Nginx)

### 4.3 Worker Service (`apps/worker`)

**Runtime:** Node.js 20 LTS + BullMQ 5.x

| Queue | Concurrency | Retry | Purpose |
|-------|------------|-------|---------|
| `email:send-batch` | 10 | 5× exponential | Postmark batch send (1000/batch) |
| `email:welcome` | 5 | 3× | Welcome emails after subscribe/import |
| `email:transactional` | 20 | 3× | Password reset, payment confirmation |
| `sitemap:update` | 1 | 2× | Regenerate sitemap.xml after publish |

**Retry schedule:** 1s → 2s → 4s → 8s → 16s (exponential backoff)

**Port:** None (background process, no HTTP)

---

## 5. Technology Stack

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **API Framework** | Fastify | 4.x | 2× faster than Express; built-in schema validation; Substack also Node.js |
| **Frontend** | Next.js | 15 (App Router) | SSR critical for SEO; React ecosystem; ISR for performance |
| **Language** | TypeScript | 5.x | Type safety across monorepo; shared types between API/Web |
| **Database** | PostgreSQL | 16 | ACID guarantees; JSONB for email metadata; Substack's choice |
| **Cache/Queue** | Redis | 7.x | Sessions, rate limiting, BullMQ backend — single dependency |
| **Job Queue** | BullMQ | 5.x | Redis-backed; retries; visibility; dashboard (Bull-Board) |
| **File Storage** | MinIO | RELEASE.2024 | Self-hosted S3-compatible; VPS-first; no vendor lock |
| **Email Delivery** | Postmark | REST API | Highest deliverability; transactional focus; webhook support |
| **Email Fallback** | Resend | REST API | Modern API; easy swap; same webhook format |
| **Payments Global** | Stripe | v2025 | Webhooks; Connect; Checkout UI; industry standard |
| **Payments RU** | CloudPayments | REST API | Only viable card processing for RU market |
| **AI** | Claude API (MCP) | claude-sonnet-4-6 | MCP integration per architecture constraint; best-in-class writing quality |
| **Reverse Proxy** | Nginx | 1.25 | TLS termination; load balancing; static file serving |
| **CDN** | Cloudflare | Free | DDoS; edge cache for static assets; DNS management |
| **Containerization** | Docker + Compose | 24 + v2 | VPS-native; simple ops; single-node orchestration |
| **ORM** | Prisma | 5.x | Type-safe queries; migrations; PostgreSQL support |
| **Validation** | Zod | 3.x | Runtime validation; shared schemas API↔Web |
| **Auth** | jose (JWT) | 5.x | JWT sign/verify; lightweight; standards-compliant |
| **HTML Sanitization** | DOMPurify | 3.x | XSS prevention on user-generated content |
| **Email Templates** | React Email | 2.x | JSX-based templates; tested across clients |
| **Monitoring** | Prometheus + Grafana | Latest | Self-hosted; VPS-compatible; no SaaS cost |
| **Error Tracking** | Sentry | Self-hosted | Error aggregation; source maps; performance |
| **Search (MVP)** | PostgreSQL FTS | — | tsvector/tsquery; sufficient for author search |
| **Search (v1)** | Meilisearch | 1.x | Upgrade path when needed; Rust-based performance |
| **Testing** | Vitest + Playwright | Latest | Unit/integration (Vitest); E2E (Playwright) |
| **Monorepo** | pnpm workspaces | 9.x | Hoisted deps; workspace protocol; fast installs |
| **Build** | Turborepo | 2.x | Parallel builds; remote cache support |

---

## 6. Monorepo Structure

```
inkflow/
├── apps/
│   ├── api/                    # Fastify API server
│   │   ├── src/
│   │   │   ├── modules/        # Feature modules
│   │   │   │   ├── auth/
│   │   │   │   ├── publications/
│   │   │   │   ├── posts/
│   │   │   │   ├── subscribers/
│   │   │   │   ├── email/
│   │   │   │   ├── payments/
│   │   │   │   └── ai/
│   │   │   ├── shared/         # Middleware, utils, types
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── Dockerfile
│   ├── web/                    # Next.js SSR app
│   │   ├── app/
│   │   │   ├── (dashboard)/    # Auth-gated author UI
│   │   │   ├── [slug]/         # Public publication pages
│   │   │   └── api/            # Route handlers (proxy)
│   │   ├── components/
│   │   └── Dockerfile
│   └── worker/                 # BullMQ workers
│       ├── src/
│       │   ├── queues/
│       │   ├── processors/
│       │   └── main.ts
│       └── Dockerfile
├── packages/
│   ├── shared-types/           # Zod schemas + TypeScript types
│   ├── email-templates/        # React Email templates
│   ├── ui/                     # Shared React components
│   └── config/                 # ESLint, TypeScript, Tailwind configs
├── docker-compose.yml          # Full stack definition
├── docker-compose.dev.yml      # Dev overrides (volume mounts, hot reload)
├── nginx/
│   └── nginx.conf
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/
│       └── dashboards/
├── scripts/
│   ├── deploy.sh
│   └── backup.sh
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 7. Docker Compose Services

```yaml
services:
  api:
    build: ./apps/api
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://inkflow:${PG_PASSWORD}@postgres:5432/inkflow
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - POSTMARK_API_KEY=${POSTMARK_API_KEY}
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET}
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - MINIO_ENDPOINT=minio
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
    depends_on: [postgres, redis, minio]
    networks: [inkflow]

  web:
    build: ./apps/web
    restart: unless-stopped
    environment:
      - API_URL=http://api:3001
      - NEXT_PUBLIC_API_URL=${PUBLIC_URL}/api
    depends_on: [api]
    networks: [inkflow]

  worker:
    build: ./apps/worker
    restart: unless-stopped
    environment:
      - DATABASE_URL=postgresql://inkflow:${PG_PASSWORD}@postgres:5432/inkflow
      - REDIS_URL=redis://redis:6379
      - POSTMARK_API_KEY=${POSTMARK_API_KEY}
      - RESEND_API_KEY=${RESEND_API_KEY}
    depends_on: [postgres, redis]
    networks: [inkflow]
    deploy:
      replicas: 2        # Horizontal scale for email throughput

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=inkflow
      - POSTGRES_PASSWORD=${PG_PASSWORD}
      - POSTGRES_DB=inkflow
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks: [inkflow]

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks: [inkflow]

  minio:
    image: minio/minio:latest
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    networks: [inkflow]

  nginx:
    image: nginx:1.25-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on: [api, web]
    networks: [inkflow]

  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks: [inkflow]

  grafana:
    image: grafana/grafana:latest
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
    depends_on: [prometheus]
    networks: [inkflow]

volumes:
  postgres_data:
  redis_data:
  minio_data:
  prometheus_data:
  grafana_data:

networks:
  inkflow:
    driver: bridge
```

---

## 8. Data Architecture

### 8.1 Database Schema (Full)

```sql
-- Core auth
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'author'
    CHECK (role IN ('author', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_email ON users(email);

-- Publications
CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url TEXT,
  custom_domain VARCHAR(255) UNIQUE,
  sending_email VARCHAR(255),
  stripe_account_id VARCHAR(255),
  pricing_monthly INTEGER,    -- cents
  pricing_annual INTEGER,     -- cents
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_publications_author ON publications(author_id);
CREATE INDEX idx_publications_slug ON publications(slug);

-- Posts
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  content_html TEXT,
  excerpt TEXT,
  slug VARCHAR(255) NOT NULL,
  cover_image_url TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sent', 'published')),
  access VARCHAR(10) NOT NULL DEFAULT 'free'
    CHECK (access IN ('free', 'paid')),
  seo_title VARCHAR(60),
  seo_description VARCHAR(160),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(publication_id, slug)
);
CREATE INDEX idx_posts_publication ON posts(publication_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled ON posts(scheduled_at) WHERE status = 'scheduled';

-- Subscribers
CREATE TABLE subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending_confirmation'
    CHECK (status IN ('pending_confirmation', 'active', 'unsubscribed', 'bounced', 'spam')),
  tier VARCHAR(10) NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'paid', 'trial', 'past_due')),
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  confirmation_token VARCHAR(255),
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(publication_id, email)
);
CREATE INDEX idx_subscribers_publication ON subscribers(publication_id, status);
CREATE INDEX idx_subscribers_stripe ON subscribers(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- Email sends
CREATE TABLE email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id),
  subscriber_id UUID NOT NULL REFERENCES subscribers(id),
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  sent_at TIMESTAMPTZ,
  message_id VARCHAR(255),
  UNIQUE(post_id, subscriber_id)
);
CREATE INDEX idx_email_sends_post ON email_sends(post_id);
CREATE INDEX idx_email_sends_status ON email_sends(status);

-- Email events (open/click/bounce)
CREATE TABLE email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_send_id UUID NOT NULL REFERENCES email_sends(id),
  event_type VARCHAR(20) NOT NULL
    CHECK (event_type IN ('open', 'click', 'bounce', 'spam_complaint', 'delivery')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB    -- {url, userAgent, ip}
);
CREATE INDEX idx_email_events_send ON email_events(email_send_id);
CREATE INDEX idx_email_events_type ON email_events(event_type, occurred_at);

-- AI usage audit log
CREATE TABLE ai_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES users(id),
  publication_id UUID NOT NULL REFERENCES publications(id),
  topic TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 8.2 Redis Key Schema

| Key Pattern | TTL | Value | Purpose |
|-------------|-----|-------|---------|
| `session:{userId}:refresh:{tokenId}` | 7d | `1` | Refresh token blacklist check |
| `ratelimit:{ip}:anon` | 60s | counter | Anonymous rate limiting |
| `ratelimit:{userId}:auth` | 60s | counter | Auth rate limiting |
| `ai_ratelimit:{authorId}` | 1h | counter | AI usage per-author |
| `post_preview:{postId}` | 30min | JSON | Draft preview cache |
| `bull:email:*` | — | BullMQ | Email job queue |

---

## 9. Security Architecture

### 9.1 Authentication Flow

```
1. POST /api/auth/login
   → bcrypt.compare(password, hash) [cost=12]
   → generate accessToken (JWT, HS256, 15min)
   → generate refreshToken (JWT, HS256, 7d, stored in Redis)
   → Set-Cookie: refreshToken (HttpOnly, Secure, SameSite=Strict)
   → Return: { accessToken }

2. API Request
   → Authorization: Bearer {accessToken}
   → Verify JWT signature + expiry
   → Attach user to request context

3. Token Refresh
   → POST /api/auth/refresh (cookie sent automatically)
   → Verify refreshToken against Redis (not blacklisted)
   → Rotate: issue new pair, blacklist old refreshToken
```

### 9.2 Security Controls

| Layer | Control | Implementation |
|-------|---------|---------------|
| Transport | HTTPS only | Nginx + Let's Encrypt + HSTS |
| Authentication | JWT + Refresh rotation | jose library |
| Password | bcrypt | cost factor 12 (≈150ms hash) |
| Session invalidation | Redis blacklist | token jti stored |
| Rate limiting | Sliding window | Redis + fastify-rate-limit |
| Input validation | Schema validation | Zod on all API inputs |
| XSS prevention | HTML sanitization | DOMPurify server-side |
| SQL injection | Parameterized queries | Prisma (never raw concat) |
| Webhook auth | HMAC signature | Stripe: constructEvent(); Postmark: header |
| CORS | Allowlist | Only inkflow.io + custom domains |
| File upload | Type + size limits | MIME validation, 10MB max |
| Secrets | Environment variables | Never in code; Docker secrets in prod |

### 9.3 Email Authentication (DMARC/DKIM/SPF)

```
DNS records required per sending domain:
→ SPF:   v=spf1 include:spf.postmarkapp.com ~all
→ DKIM:  Postmark generates 2048-bit key; CNAME to Postmark
→ DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@inkflow.io
```

---

## 10. Scalability Architecture

### 10.1 Horizontal Scaling Points

| Service | Scale Trigger | Strategy |
|---------|--------------|---------|
| API | CPU > 70% | `deploy.replicas: N` in Compose |
| Worker | Queue depth > 5000 | `deploy.replicas: N` |
| PostgreSQL | Read IOPS > 1000/s | PgBouncer connection pooler + read replica |
| Redis | Memory > 4GB | Redis Cluster or increase VPS RAM |

### 10.2 Email Throughput Calculation

```
Target: 100K subscribers × publication send
Postmark batch API: 500 emails/request, ~200ms latency
1 worker × 10 concurrency = 25,000 emails/min
2 workers × 10 concurrency = 50,000 emails/min
→ 100K send = ~2 minutes with 2 worker replicas ✅

Scale to 1M subscribers:
→ Need ~8 worker replicas OR upgrade to dedicated Postmark server
→ Postmark dedicated IP = better deliverability at scale
```

### 10.3 Database Connection Pooling

```
PgBouncer (transaction mode):
  pool_mode = transaction
  max_client_conn = 1000
  default_pool_size = 25
  reserve_pool_size = 5

→ 2 API replicas × 20 Prisma connections = 40 DB connections
→ PgBouncer multiplexes → PostgreSQL sees max 30 connections
```

---

## 11. AI Integration (MCP)

```mermaid
sequenceDiagram
    participant Author as Author Browser
    participant API as API Service
    participant MCP as MCP Server (Claude)
    participant Claude as Claude API

    Author->>API: POST /api/ai/generate-draft {topic}
    API->>API: Rate limit check (Redis, 10/hour)
    API->>API: Load publication context (DB)
    API->>MCP: invoke generate_draft tool
    MCP->>Claude: messages.create {system, user, model}
    Claude-->>MCP: {content, usage}
    MCP-->>API: {draft, tokens}
    API->>API: Log AI usage (DB)
    API-->>Author: {draft: "..."}
```

**MCP Server Configuration (`.mcp.json`):**
```json
{
  "mcpServers": {
    "claude-writing-assistant": {
      "command": "node",
      "args": ["./mcp-servers/writing-assistant/index.js"],
      "env": {
        "ANTHROPIC_API_KEY": "${CLAUDE_API_KEY}",
        "MODEL": "claude-sonnet-4-6",
        "MAX_TOKENS": "1500"
      }
    }
  }
}
```

---

## 12. Custom Domain Architecture

```
1. Author configures: mysite.com → publication

2. DNS Setup (author does this):
   CNAME: mysite.com → publications.inkflow.io

3. Nginx wildcard proxy:
   server_name *.inkflow.io;
   → Extract slug from subdomain
   → Proxy to web service

4. Custom domain handler:
   server_name ~^(?<domain>.+)$;
   → DB lookup: SELECT * FROM publications WHERE custom_domain = $domain
   → Proxy to web service with X-Publication-Id header

5. TLS for custom domains:
   → Certbot with DNS challenge (Cloudflare API)
   → Auto-renewal via cron
   → Wildcard cert for *.inkflow.io
   → Per-domain cert for custom domains (Let's Encrypt ACME)
```

---

## 13. Observability

### 13.1 Metrics (Prometheus)

| Metric | Type | Labels | Alert Threshold |
|--------|------|--------|----------------|
| `http_request_duration_seconds` | Histogram | method, route, status | p99 > 200ms |
| `email_send_queue_depth` | Gauge | queue_name | > 10000 |
| `email_delivery_success_total` | Counter | provider | — |
| `email_delivery_failure_total` | Counter | provider, error | rate > 2% |
| `db_query_duration_seconds` | Histogram | operation | p99 > 50ms |
| `active_subscribers_total` | Gauge | tier | — |
| `ai_tokens_used_total` | Counter | model | cost alert |

### 13.2 Structured Logging (JSON)

```json
{
  "level": "info",
  "time": "2026-04-23T10:00:00Z",
  "requestId": "req_01234567",
  "userId": "usr_abcdef",
  "method": "POST",
  "path": "/api/posts/abc/send",
  "statusCode": 200,
  "duration": 45,
  "msg": "Post send triggered"
}
```

Log levels: DEBUG (dev only) → INFO (normal ops) → WARN (degraded) → ERROR (alert) → FATAL (page)

---

> ⚠️ **Disclaimer:** Architecture estimates (throughput, scaling triggers) are projections based on Postmark and PostgreSQL benchmarks. Validate with load testing before production traffic. Infrastructure choices are optimized for VPS single-node deployment — cloud migration path exists but requires additional networking configuration.

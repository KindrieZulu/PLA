# PLA Deployment Status Report
**Deployed:** 2026-07-17 12:50 UTC  
**Environment:** Local Development  
**Mode:** Backend API + Static Frontend (Demo Mode)

---

## ✅ Services Running

| Service | Port | Status | Details |
|---------|------|--------|---------|
| **Backend API** | 5000 | 🟢 Running | Node.js Express, limited mode (no DB) |
| **Frontend** | 3000 | 🟢 Running | Static HTML served via Python HTTP server |

---

## ✅ Health Check Results

| Check | Status | Details |
|-------|--------|---------|
| Backend Health | ✅ PASS | `{"status":"ok","service":"pla-backend"}` |
| API Info | ✅ PASS | `{"name":"PLA API","version":"1.0.0"}` |
| Prometheus Metrics | ✅ PASS | Exposing process/http metrics |
| Security Headers | ✅ PASS | Full Helmet.js suite: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, XSS |
| Rate Limiting | ✅ PASS | `RateLimit-Limit: 300`, `RateLimit-Remaining: 297` per 15min window |
| Frontend | ✅ PASS | Serving PLA UI on port 3000 |
| Test Suite | ✅ PASS | **50/50 tests passed** |

---

## 🔒 Security Features Active

- **JWT Authentication** — 15min access tokens, 7-day refresh tokens
- **Rate Limiting** — 300 req/15min global, 10 auth req/15min, per-endpoint limits
- **Brute Force Protection** — 5 failed attempts → 15min lockout
- **Security Headers** — CSP, HSTS, X-Frame-Options, XSS Protection
- **Input Sanitization** — XSS-clean, HPP protection
- **CORS** — Configurable allowed origins
- **Audit Logging** — All requests logged with request IDs
- **Request ID Tracking** — UUID per request for tracing

---

## 📊 Observability Stack

- **Prometheus Metrics** — `GET /metrics` (process CPU, memory, HTTP request duration, rate limit hits)
- **Structured Logging** — Winston with JSON format, log levels
- **Health Endpoints** — `/health`, `/health/live`, `/health/ready`
- **Grafana Dashboards** — Pre-configured (available in Docker mode on port 3001)
- **Alert Rules** — Defined for high error rates, memory usage, response times

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Frontend (3000)                │
│          Static HTML / React SPA                │
└─────────────────────┬───────────────────────────┘
                      │ API calls
┌─────────────────────▼───────────────────────────┐
│              Backend API (5000)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ Helmet   │ │ Rate     │ │ JWT Auth         ││
│  │ Security │ │ Limiter  │ │ + Refresh Tokens ││
│  └──────────┘ └──────────┘ └──────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │ BKT      │ │ IRT      │ │ Adaptive         ││
│  │ Service  │ │ Service  │ │ Question Engine  ││
│  └──────────┘ └──────────┘ └──────────────────┘│
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐│
│  │PostgreSQL│ │ MongoDB  │ │ Redis            ││
│  │(primary) │ │(sessions)│ │(cache/ratelimit) ││
│  └──────────┘ └──────────┘ └──────────────────┘│
└─────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Commands

```bash
# Start (dev mode)
./scripts/deploy.sh dev

# Start (Docker mode - with all databases)
./scripts/deploy.sh docker

# Check status
./scripts/deploy.sh status

# View logs
./scripts/deploy.sh logs

# Run tests
./scripts/deploy.sh test

# Stop all
./scripts/deploy.sh stop
```

---

## 📁 Project Structure Created

```
PLA/
├── .github/workflows/          # CI/CD pipelines
│   ├── ci.yml                  # Test + Build + Deploy
│   └── security-scan.yml       # Trivy + npm audit
├── pla-backend/
│   ├── Dockerfile              # Multi-stage production build
│   ├── src/
│   │   ├── config/             # DB, Redis, Logger, Metrics, Validation
│   │   ├── controllers/        # Business logic (extensible)
│   │   ├── middleware/          # Rate limiter, Auth, RBAC, Error handler, Audit
│   │   ├── models/sql/         # PostgreSQL query layer
│   │   ├── routes/             # 15+ route modules (v1 REST API)
│   │   ├── services/           # BKT + Adaptation algorithms
│   │   └── __tests__/          # 50 tests (auth, BKT, integration)
│   └── monitoring/
│       ├── prometheus/          # Config + Alert rules
│       └── grafana/             # Dashboard + Datasource provisioning
├── pla-webApp/
│   ├── Dockerfile              # Multi-stage (build + nginx)
│   ├── nginx.conf              # Production nginx config
│   └── public/index.html       # Interactive demo UI
├── pla-mobile/                 # React Native structure (extensible)
├── k8s/                        # Kubernetes manifests
│   ├── deployment.yaml         # Backend deployment + HPA + Service
│   ├── ingress.yaml            # Ingress with TLS
│   └── config.yaml             # ConfigMap + Secrets
├── scripts/
│   ├── deploy.sh               # Main deployment script
│   └── migrate-and-seed.sh     # DB migration + demo data
├── docker-compose.yml          # Full stack (backend, pg, mongo, redis, prometheus, grafana)
├── SECURITY.md                 # Security documentation
└── pla_db.sql                  # Original schema
```

---

## 🐛 Bugs Fixed This Deployment

1. **`onLimitReached` deprecation** — Removed deprecated express-rate-limit v7 option
2. **SQL alias bug** — Fixed `sk.skill_name` → `s.skill_name` in mastery queries
3. **Auth parameter bug** — Fixed `tokenHash` → `token` in `authQueries.getRefreshToken`

---

## 📋 Demo Accounts

| Role | Username/Email | Password |
|------|----------------|----------|
| Student | `student1` | `Student123!` |
| Teacher | `teacher@demo.pla` | `Teacher123!` |

---

## ⚠️ Current Limitations

- **Demo Mode**: PostgreSQL, MongoDB, and Redis are NOT running locally. The backend operates in limited/degraded mode. Auth, database queries, and caching will return errors.
- **Full Stack**: Use `./scripts/deploy.sh docker` to run the complete stack with all databases.
- **External Access**: localhost URLs are only accessible from within this sandbox. Use `present_file` for the standalone demo preview.

# PLA — Personalised Learning Assistant

An adaptive learning platform for ZIMSEC Form 1 Mathematics. Uses Bayesian Knowledge Tracing (BKT) to personalise question difficulty and content recommendations for each student in real time.

---

## Architecture

```
pla-backend/       Node.js + Express API (REST + Socket.io)
  ├─ PostgreSQL     Students, classes, questions, skills, mastery
  └─ MongoDB        Sessions, attempts, audit logs, feedback

pla-webApp/        React (CRA) — student dashboard + teacher portal
pla-mobile/        React Native (Expo) — cross-platform mobile app
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 18 LTS or 20 LTS |
| npm | 9+ |
| PostgreSQL | 14–16 |
| MongoDB | 6–7 |
| Expo CLI | via `npx expo` |
| Docker + Compose | optional (simplest setup) |

---

## Quick Start — Docker (recommended)

```bash
# 1. Clone the repo
git clone <repo-url>
cd "Personalised Learning Assistant"

# 2. Copy and fill in the backend .env
cp pla-backend/.env.example pla-backend/.env
# Edit JWT_SECRET, POSTGRES_PASSWORD, etc.

# 3. Start Postgres + MongoDB + Backend together
docker compose up -d

# 4. Import the database schema + seed data
docker exec -i pla-postgres psql -U postgres -d pla_db < pla_db.sql
cd pla-backend && npm run seed:demo

# 5. Start the web app
cd ../pla-webApp && npm install && npm start
```

---

## Manual Setup (without Docker)

### 1. Backend

```bash
cd pla-backend
npm install

# Copy .env and configure it
cp .env.example .env
# Required: JWT_SECRET, POSTGRES_HOST/USER/PASSWORD/DB, MONGO_URI

# Create the PostgreSQL database
createdb -U postgres pla_db

# Import schema + data
psql -U postgres -d pla_db -f ../pla_db.sql

# Run any pending migrations
npm run migrate

# Seed demo accounts (teacher + 5 students)
npm run seed:demo

# Start the server
npm run dev      # nodemon (hot reload)
npm start        # production
```

The API will be available at `http://localhost:5000`.

### 2. Web App

```bash
cd pla-webApp
npm install
npm start        # opens http://localhost:3000
```

> The web app proxies all `/api` requests to `localhost:5000` (configured in `package.json`).

### 3. Mobile App

```bash
cd pla-mobile
npm install

# Set the API URL for your local network IP
# In pla-mobile/.env (or app.config.js):
#   EXPO_PUBLIC_API_URL=http://<your-lan-ip>:5000

npx expo start   # scan QR code with Expo Go on your phone
```

> Use your LAN IP (e.g. `192.168.x.x`), not `localhost`, so a physical device
> can reach the backend. For Android emulator only, `10.0.2.2` works.

---

## Environment Variables

Copy `pla-backend/.env.example` → `pla-backend/.env` and set:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Random string ≥ 32 chars — **keep secret** |
| `JWT_EXPIRES_IN` | Token lifetime (default `15m`) |
| `POSTGRES_HOST` | Postgres host (default `localhost`) |
| `POSTGRES_PORT` | Postgres port (default `5432`) |
| `POSTGRES_USER` | Postgres user |
| `POSTGRES_PASSWORD` | Postgres password |
| `POSTGRES_DB` | Database name (default `pla_db`) |
| `MONGO_URI` | MongoDB connection string |
| `CORS_ORIGIN` | Allowed origins in production (comma-separated) |
| `LOG_LEVEL` | `error` \| `warn` \| `info` \| `debug` |
| `PORT` | API port (default `5000`) |

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Demo Credentials

After running `npm run seed:demo`:

| Role    | Username         | Password      |
|---------|------------------|---------------|
| Teacher | `ms.moyo`        | `Teacher1234` |
| Student | `tinashe.moyo`   | `Test1234`    |
| Student | `chipo.ndlovu`   | `Test1234`    |
| Student | `takoda.banda`   | `Test1234`    |
| Student | `rudo.chikwanda` | `Test1234`    |
| Student | `farai.mutasa`   | `Test1234`    |

**Class code** (for new student registration): `FORM1A`

---

## Running Tests

```bash
cd pla-backend
npm test              # all tests, single run
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

All 82 tests use fully mocked databases — no real PostgreSQL or MongoDB connection required.

---

## Database Migrations

```bash
cd pla-backend
npm run migrate           # apply pending migrations
npm run migrate:status    # show migration history
```

Migrations live in `pla-backend/scripts/migrations/`.

---

## Project Structure

```
pla-backend/
  src/
    app.js                  Express app factory
    config/                 Postgres pool, Mongo connection, logger
    controllers/            Request handlers (auth, dashboard, attempts …)
    middleware/             JWT auth, validators, rate limiter, error handler
    models/
      mongo/                Session, Attempt, AuditLog, FeedbackLog
    routes/                 Express routers
    services/               BKT engine, audit service
    __tests__/              Integration tests (all mocked)
  scripts/
    migrate.js              Migration runner
    seed-demo.js            Demo data seed
    migrations/             Numbered SQL migration files

pla-webApp/
  src/
    api/api.js              Axios wrapper for all endpoints
    components/             Navbar, ProgressBar, MasteryMap, QuestionCard …
    context/AuthContext.js  JWT token management
    pages/                  Dashboard, Quiz, TeacherDashboard, Admin …

pla-mobile/
  src/
    api/api.js              Axios wrapper (same endpoints)
    components/
      UIComponents.js       Design-system components (Button, Card, Badge …)
    context/
      AuthContext.js        Token storage via AsyncStorage
      SessionContext.js     Active session management
    screens/                LoginScreen, DashboardScreen, QuizScreen …
    utils/
      theme.js              Design tokens (colours, spacing, fonts, shadows)
      offlineStore.js       AsyncStorage queue for offline attempts
      syncService.js        Background sync of queued attempts
      answerUtils.js        Client-side answer equivalence checker
    navigation/             RootNavigator, StudentTabs, TeacherStack, AuthStack
```

---

## Key Features

- **Adaptive questions** — BKT selects the right difficulty for each student
- **Offline mode** — practise without internet; attempts sync automatically on reconnect
- **Real-time feedback** — Socket.io pushes mastery updates to the student during a live session
- **Teacher dashboard** — class overview, per-student skill map, session history
- **Diagnostic test** — initial assessment that bootstraps each student's mastery profile
- **Reading materials** — personalised notes and worked examples for weak skills
- **Mastery map** — visual breakdown of skill progress by module
- **JWT + refresh tokens** — secure, stateless authentication with token rotation

---

## API Overview

Base URL: `http://localhost:5000/api/v1`

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | Login — returns access + refresh token |
| POST | `/auth/register` | Student self-registration with class code |
| POST | `/auth/refresh` | Rotate refresh token |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/dashboard` | Student dashboard summary |
| GET | `/sessions` | Start / list sessions |
| POST | `/sessions/:id/end` | End a session |
| GET | `/questions/adaptive` | Next adaptive question for session |
| POST | `/attempts` | Submit an answer |
| POST | `/sync` | Bulk sync offline attempts |
| GET | `/mastery` | Student's full mastery profile |
| GET | `/materials` | Personalised reading materials |
| GET | `/diagnostic/questions` | Diagnostic test questions |
| POST | `/diagnostic/submit` | Submit diagnostic answers |
| GET | `/teacher/students` | Teacher's student list |
| GET | `/teacher/students/:id/summary` | Student detail + mastery |
| GET | `/teacher/class-overview` | Class-wide skill breakdown |
| GET | `/health` | Health check |

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Monorepo layout

```
/
├── pla-backend/    Node/Express API server (port 5000)
├── pla-webApp/     React SPA (CRA, port 3000)
└── pla-mobile/     Expo React Native app
```

Each sub-project has its own `package.json` and must be `cd`-ed into before running commands.

---

## Dev commands

### Backend (`pla-backend/`)
```bash
npm run dev          # nodemon (hot-reload)
npm start            # node server.js (production)
npm test             # jest --forceExit
npm run test:watch   # jest --watch (single file: jest -- path/to/file)
npm run migrate      # run pending SQL migrations
npm run migrate:status
npm run seed:demo    # seed demo data
```
Env: copy `.env.example` → `.env`. Requires Postgres (`pla_db`) and MongoDB running locally.

### Web app (`pla-webApp/`)
```bash
npm start   # CRA dev server
npm test    # react-scripts test (Jest + RTL)
npm run build
```
Env: `REACT_APP_API_URL=http://localhost:5000` (falls back to same origin if unset).

### Mobile (`pla-mobile/`)
```bash
npx expo start           # Metro bundler
npx expo start --android
npx expo start --ios
```
Env: `EXPO_PUBLIC_API_URL=http://10.0.2.2:5000` for Android emulator; iOS simulator uses `localhost`.

---

## Backend architecture

**Pattern:** Route → Controller → Service/Query. No business logic in controllers beyond request parsing and response shaping.

```
src/
├── app.js                   # Express factory (middleware stack, route mounting)
├── server.js                # HTTP server + DB connection bootstrap
├── config/
│   ├── postgres.js          # pg Pool (env-driven)
│   ├── mongo.js             # Mongoose connect
│   ├── logger.js            # Winston (LOG_LEVEL env)
│   └── validateEnv.js       # Throws on missing required env vars at startup
├── models/
│   ├── sql/queries.js       # All raw SQL queries — the only file that touches pg Pool
│   └── mongo/               # Mongoose schemas: Session, Attempt, FeedbackLog, AuditLog
├── routes/                  # Router files (thin — just attach validators + controller)
├── controllers/             # Request/response handlers
├── services/
│   ├── bktService.js        # BKT mastery engine
│   ├── adaptationService.js # Next-question selection logic
│   ├── auditService.js      # MongoDB audit trail
│   └── strengthweaknessService.js
├── middleware/
│   ├── authMiddleware.js    # JWT verify; attaches req.user
│   ├── roleMiddleware.js    # requireTeacher / requireAdmin
│   ├── validators/          # express-validator chains (auth, attempt, session, admin)
│   └── errorHandler.js      # Global error handler; Express 5 async errors auto-caught
└── __tests__/               # Integration tests (supertest); setup.js mocks both DBs
```

**Route mounting** (app.js): both `/api/v1/auth` and `/api/auth` are registered for backward compatibility. Prefer `/api/v1/` in new code.

**Rate limiting:** global 300 req/15 min on `/api/*`; auth routes get a separate 10 req/15 min limiter.

---

## Dual-database split

| Store | What lives there |
|---|---|
| **PostgreSQL** (`pla_db`) | Students, classes, teachers, questions, skills, skill mastery, homework, reading materials, avatars |
| **MongoDB** (`pla_db`) | Sessions (time-series), per-attempt detail, feedback logs, audit trail |

All PostgreSQL access goes through `src/models/sql/queries.js` — no raw `pool.query` calls anywhere else. Mongo Mongoose models are in `src/models/mongo/`.

Soft-delete pattern: `deleted_at IS NULL` guard on all student queries. No hard deletes.

---

## BKT + IRT engine (`pla-backend/src/services/bktService.js`)

### BKT
```
updateBKT(previousMastery, isCorrect, hintUsed, skillParams, responseTimeSeconds, difficultyLevel, streak, tryCount)
→ { masteryProbability, masteryStatus, bktDetail }
```

**Modifiers applied on top of standard BKT:**
- Response-time multiplier (fast+correct → boost; slow → penalty)
- Hint penalty (reduces effective p_learn)
- Streak bonus (consecutive correct answers)
- Try-count multiplier (repeated wrong answers dampen slip)

**Mastery thresholds:** `mastered` ≥ 0.80 · `in_progress` ≥ 0.50 · `needs_support` < 0.50. Clamped to `[0.05, 0.98]`.

**DEFAULT_PARAMS:** `{ prior: 0.30, learn: 0.20, slip: 0.10, guess: 0.20 }`. Per-skill overrides stored in the `skills` table (`bkt_prior`, `bkt_learn`, `bkt_slip`, `bkt_guess`).

### IRT 2-Parameter Logistic Model (2PL)

**Addresses Objective O1** (BKT and IRT). Runs alongside BKT on every attempt.

```
updateIRTAbility(theta, isCorrect, difficultyLevel)
→ { thetaNew, pCorrect, irtDetail }

P_2PL(theta, a=1.0, b) = 1 / (1 + exp(-a(θ-b)))
```

- **θ** (theta): per-skill ability estimate, range `[-3, +3]`, stored in `mastery.theta_estimate`
- **b values:** Easy → `-1.0` · Medium → `0.0` · Hard → `+1.0`  
- **Update rule:** `θ_new = θ + 0.3 × (isCorrect − P(θ,a,b))` (gradient-step EAP approximation)
- **getZPDDifficulty(theta):** selects ZIMSEC difficulty tier where P ≈ 0.65 (Zone of Proximal Development)
- **getAbilityLabel(theta):** maps θ to plain-English levels: `Needs Support | Foundational | Developing | Proficient | Advanced`

`upsertMasteryWithTheta()` saves both BKT mastery and IRT theta in one round-trip.

---

## Open Learner Model (`GET /api/v1/olm`)

**Addresses Objective O2 + Chapter 2 SMILI gap** (Bull & Kay, 2010). Provides full transparency of the learner model.

- Returns: `{ ability: { theta, label, description, color }, curriculum: { overallPercent, masteredSkills, activeModule, predictedSessions }, modules[], skills[] }`
- `olmController.js` → `olmRoutes.js` → registered at `/api/v1/olm` and `/api/olm`
- Web: `OLMPanel` component rendered in `Dashboard.js` (ability card + curriculum progress + module bars)
- Mobile: `OLMCard` component in `DashboardScreen.js`

---

## VirtualTA (`POST /api/v1/virtualTA/query`)

**Addresses Objective O3** ("VirtualTA with Whisper Speech API"). Rule-based, no external AI cost — curriculum-grounded responses from PostgreSQL.

**Request:** `{ message, skillId?, questionId? }`  
**Response:** `{ reply, type, suggestions[] }`

**Intent classification** (pattern-matched): `hint | explain | example | answer | progress | next_step | encourage | greet | general`

- `virtualTAController.js` → `virtualTARoutes.js` → `/api/v1/virtualTA/query`
- Web: `VirtualTA.js` floating widget (bottom-right FAB) — mounted in `Dashboard.js` **and** `Quiz.js`; passes `skillId`/`questionId` from active question for contextual help
- Voice input: browser Web Speech API (`SpeechRecognition`) — free, no external API key, works on Chrome/Android
- Mobile: `AskTAScreen.js` — full-screen chat, tab in `StudentTabs` + shortcut button in `QuizScreen`; `@react-native-voice/voice` for STT (graceful fallback to text-only if not installed)

---

## Auth flow

**Access token:** JWT, 15 m TTL, signed with `JWT_SECRET`. Payload: `{ id, username, role }`.

**Refresh token:** opaque random token stored in Postgres (`refresh_tokens` table). Rotation on every use — old token is invalidated when a new one is issued.

**Mobile storage:** `pla_token` + `pla_refresh_token` + `pla_user` in AsyncStorage.

**Silent refresh (mobile):** Axios response interceptor in `pla-mobile/src/api/api.js` queues concurrent 401 responses while one refresh call is in flight. `setTokenRefreshedCallback` connects the interceptor to `AuthContext` state so the in-memory token stays in sync.

**Account lockout:** in-memory Map in `authController.js`. 5 failures → 15-minute lockout. Not shared across Node processes — use Redis if you scale horizontally.

---

## Mobile theme / dark mode

**`useTheme()` hook** (ThemeContext) returns `{ colors, isDark, toggleTheme }`.  
`colors` = `lightTheme | darkTheme` object from `src/utils/theme.js`.

**Pattern in every screen:**
```js
import { colors as staticColors, spacing, ... } from '../utils/theme'; // module-level static palette
import { useTheme } from '../context/ThemeContext';

export default function MyScreen() {
  const { colors } = useTheme();  // reactive semantic tokens
  // Use colors.bg, colors.surface, colors.text, colors.border, etc.
  // Use staticColors.green500 / staticColors.gold500 / staticColors.red500
  //   for accent colours that must NOT flip on dark mode (badge fills, stat icons).
}
```

**Sub-component pattern:** parent calls `useTheme()` once and passes `colors` as a prop to pure sub-components. Sub-components do NOT call `useTheme()` themselves.

**Semantic token reference:**
| Token | Light | Dark |
|---|---|---|
| `bg` | `#f8fafc` | `#0f172a` |
| `surface` | `#ffffff` | `#1e293b` |
| `surfaceAlt` | `#f1f5f9` | `#334155` |
| `text` | `#0f172a` | `#f8fafc` |
| `textSub` | `#475569` | `#cbd5e1` |
| `textMuted` | `#94a3b8` | `#64748b` |
| `border` | `#e2e8f0` | `#334155` |
| `heroBg` | `#0a2e1a` | `#020c06` |
| `heroText` | `#c4f5d9` | `#85e3b0` |

---

## Mobile navigation

Single flat `Stack.Navigator` in `RootNavigator.js`, `initialRouteName="Welcome"`. ALL screens (auth + Student tabs + Teacher screens) are registered in one stack.

**Post-login reset:**
```js
navigation.reset({ index: 0, routes: [{ name: 'Student' }] });  // or 'Teacher'
```

**Logout from nested tab navigator:**
```js
navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Welcome' }] });
```

`StudentTabs.js` wraps five bottom tabs: Home (DashboardStack), Practice (QuizStack), Materials (MaterialsStack), Homework, Profile (ProfileStack).

---

## Web dark mode (CSS)

`ThemeContext` sets `data-theme="dark"` on `<html>`. CSS custom properties in `src/index.css` drive the whole system.

**Key remapping in dark mode:**
- `--white` → `#1e293b` (card surface). Every `background: var(--white)` becomes dark automatically.
- Slate scale is inverted (`--slate-50` becomes darkest, `--slate-900` becomes lightest).
- `--green-50` / `--green-100` / `--red-50/100` become dark badge fills.

**Pitfall:** `--green-100` in dark mode = `#0a2a18` (dark background fill). Do NOT use it for text color. Targeted overrides live in `index.css` under `/* DARK MODE COMPONENT FIXES */`. When adding a new component that uses `var(--green-100)` as text, add an explicit `[data-theme="dark"] .my-class { color: #c4f5d9; }` override.

**Auth pages are dark-mode immune.** `Login.css`, `Welcome.css`, `Register.css`, `RegisterStudent.css`, `RegisterTeacher.css` use zero CSS variables — all colors are hardcoded hex. Do NOT add `var()` to these files.

**Dark mode override placement:** all component-level dark mode fixes go in `src/index.css` (the `DARK MODE COMPONENT FIXES` section), not in component CSS files. This keeps all theme logic in one place.

---

## Web routing & guards

`App.js` uses four guard wrappers:
- `Protected` — any logged-in user
- `TeacherOnly` — `role === 'teacher'`
- `AdminOnly` — `role === 'admin'`
- `LoginGuard` / `RegisterGuard` — redirect away if already authenticated

Root `/` renders `<Welcome>` for guests; redirects logged-in users to their role's dashboard.

---

## Naming conventions

| Context | Convention |
|---|---|
| Backend files | `camelCase.js` |
| Backend SQL columns | `snake_case` |
| Backend JSON responses | `camelCase` |
| React web files | `PascalCase.js` / `PascalCase.css` |
| React Native screen files | `PascalCaseScreen.js` |
| React Native navigator files | `PascalCaseNavigator.js` or `PascalCaseTabs.js` |
| CSS classes (web) | `kebab-case` |
| CSS custom properties | `--kebab-case` |
| Mobile theme tokens | `camelCase` (matches JS object keys: `colors.textMuted`) |
| Mongo model files | `PascalCase.js` in `models/mongo/` |
| Test files | Co-located `__tests__/` folder or `*.test.js` suffix |

---

## Offline-first (mobile)

`src/utils/offlineStore.js` manages an AsyncStorage queue with an in-memory `_memoryFallback` array for storage write failures.

Key storage keys: `pla_cached_questions`, `pla_offline_queue`, `pla_cached_materials`, `pla_offline_session`.

`queueAttempt()` → returns `bool` (false means memory fallback was used). `getQueuedAttempts()` merges persisted + memory queue, deduplicated by timestamp.

Background sync runs via `src/utils/syncService.js` on reconnect (NetInfo listener).

SessionContext falls back to a local UUID session when the server is unreachable; the offline session key is `pla_offline_session`.

---

## Avatar / file uploads

Backend uses `multer` for avatar uploads. `getAvatarUrl(avatarPath)` in `pla-mobile/src/api/api.js` builds the full URL from a relative DB path. In web Navbar and mobile menus: always check `avatarUrl` before falling back to initials.

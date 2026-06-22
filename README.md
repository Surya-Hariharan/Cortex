# Cortex — Offline-First AI Productivity Platform

> A private AI second-brain for students. Semantic search over your own documents, structured notes, and local peer sharing — all running on your device. No cloud required for the core experience.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)
![Status](https://img.shields.io/badge/status-beta-orange)

---

## Features

- **Semantic Search** — Vector-based search over uploaded PDFs and notes using BGE embeddings (ONNX, runs fully locally)
- **RAG Answers** — AI-synthesized answers from your documents via local Phi-3 LLM or Ollama
- **Notes & Deadlines** — Note-taking with task, deadline, and idea categories stored in local SQLite
- **Offline Mesh Network** — Share documents with nearby peers over LAN (mDNS peer discovery)
- **Secure Auth** — JWT + bcrypt signup/login with per-email rate limiting, encrypted token storage, and forgot-password OTP flow
- **Native Desktop App** — Built with Electron; installed and runs like VS Code or Notion

---

## Project Structure

```text
Cortex/
├── apps/
│   ├── server/                 # Node.js / Express backend (port 8080)
│   │   ├── src/
│   │   │   ├── index.js            # Entry point — env guards, server start
│   │   │   ├── application.js      # Express app, middleware, routes
│   │   │   ├── controllers/        # Route handlers
│   │   │   ├── services/           # Business logic (auth, reference data)
│   │   │   ├── middleware/         # Error handler, JWT guard, correlation-id
│   │   │   ├── routes/             # Express routers
│   │   │   ├── utils/              # Token signing, logger
│   │   │   └── validators/         # Request schemas
│   │   └── package.json
│   └── desktop/                # Electron desktop app
│       ├── src/
│       │   ├── main/
│       │   │   ├── main.js         # Electron main process, IPC handlers
│       │   │   └── preload.js      # Context bridge (exposes IPC to renderer)
│       │   ├── renderer/           # React UI (compiled to dist/renderer/)
│       │   │   ├── hooks/          # Custom React hooks (useMeshDiscovery, …)
│       │   │   └── context/        # React context providers
│       │   └── services/           # API client, token store, offline identity, mesh
│       └── package.json
├── database/
│   ├── pool.js                 # Postgres connection pool
│   ├── migrations/             # Numbered SQL migration files
│   └── scripts/
│       ├── migrate.js          # Runs numbered SQL migrations
│       └── seed.js             # Seeds districts, colleges, degrees, courses
├── infra/
│   ├── Dockerfile              # Multi-stage Docker build for backend
│   └── docker-compose.yml      # Local Postgres + Redis for development
├── archive/                    # Retired code kept for reference
├── .env.example                # All environment variables documented
└── docs/ARCHITECTURE.md        # Design rationale and IPC diagram
```

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| **Node.js** | ≥ 20 LTS | [nodejs.org](https://nodejs.org) |
| **npm** | ≥ 10 | Bundled with Node 20 |
| **PostgreSQL** | 15+ | Use Supabase (free tier) **or** run locally via Docker |
| **Redis** _(optional)_ | 7+ | Required only for distributed rate-limiting; falls back to in-process memory without it |

> **Supabase quickstart**: create a free project at [supabase.com](https://supabase.com), then copy the project's connection string (Settings → Database → URI) into `DATABASE_URL`.

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourname/cortex.git
cd cortex
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in **every** value. Required variables are marked in the file; the key ones are:

| Variable | How to get it |
| --- | --- |
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (Transaction mode, port 6543) |
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Same command as above (use a **different** value) |
| `CORTEX_STORE_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | Your SMTP provider (Gmail, Resend, etc.) |

The backend refuses to start if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` are missing, shorter than 32 chars, or contain placeholder strings like `change-me`.

### 3. Install backend dependencies

```bash
cd apps/server
npm install
```

### 4. Run database migrations

```bash
# Still inside apps/server/
npm run migrate
```

This runs all numbered SQL files under `database/migrations/` in order and tracks applied migrations in a `schema_migrations` table.

### 5. Seed reference data

```bash
npm run seed
```

Populates `districts`, `degrees`, `courses`, and a starter set of `colleges` (Tamil Nadu universities). Safe to re-run — uses `ON CONFLICT DO NOTHING`.

### 6. Start the backend

```bash
npm start
```

The API server starts on `http://localhost:8080`. Verify it's running:

```bash
curl http://localhost:8080/health
# → {"ok":true,"service":"cortex-backend"}
```

### 7. Install desktop dependencies and rebuild native modules

```bash
cd ../../apps/desktop
npm install
npm run rebuild        # Recompiles better-sqlite3, onnxruntime-node, bcrypt for your Electron ABI
```

`npm run rebuild` is required after `npm install` and after upgrading Electron. Skip it and you'll get a "NODE_MODULE_VERSION mismatch" error at startup.

### 8. Build the renderer

```bash
npm run build
```

Webpack compiles the React app into `apps/desktop/dist/renderer/`.

### 9. Launch the desktop app

```bash
npm start
```

Electron opens the app window. If a session exists from a previous login, it loads the main UI directly; otherwise it shows the landing/auth page.

---

## Development Mode

To run the renderer in watch mode (hot reload) and Electron together:

```bash
# Terminal 1 — backend
cd apps/server && npm run dev

# Terminal 2 — desktop (webpack watch + electron)
cd apps/desktop && npm run dev
```

---

## AI Models (optional for offline search and RAG)

Semantic search and RAG answers require the BGE embeddings model. The LLM is needed only for AI-generated answers.

### Option A — Ollama (recommended for local LLM)

```bash
# Install from https://ollama.com, then:
ollama pull phi3
```

Cortex detects a running Ollama instance automatically.

### Option B — ONNX models (fully offline, no network)

Download and place these directories under `apps/desktop/models/`:

| Directory | Size | Purpose |
| --- | --- | --- |
| `bge-small-en-v1.5/` | ~126 MB | Embeddings (semantic search) |
| `phi-3-mini/` | ~2.4 GB | LLM text generation (RAG answers) |

### Option C — Gemini API fallback

Set `GEMINI_API_KEY` in `.env`. Cortex falls back to the Gemini API if no local model is found.

If none of the above are configured, the app still works fully for auth, notes, and PDF storage — only semantic search and AI answers require a model.

---

## Running Tests

### Backend (Jest)

```bash
cd apps/server
npm test
```

Coverage report is generated in `apps/server/coverage/`. The test suite mocks the Postgres pool and auth service so no live database is needed.

### Desktop (Vitest)

```bash
cd apps/desktop
npm test
```

---

## Environment Variable Reference

See [`.env.example`](./.env.example) for the full list with descriptions. Quick summary:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | — | Postgres connection string |
| `JWT_ACCESS_SECRET` | Yes | — | Signs short-lived access tokens |
| `JWT_REFRESH_SECRET` | Yes | — | Signs long-lived refresh tokens |
| `JWT_ACCESS_TTL` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_TTL` | No | `7d` | Refresh token lifetime |
| `CORTEX_STORE_KEY` | Yes | — | Encrypts electron-store token file |
| `REDIS_URL` | No | — | Enables distributed rate limiting |
| `SMTP_HOST` | Yes* | — | *Required for forgot-password OTP emails |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | Yes* | — | SMTP username / sender address |
| `SMTP_PASSWORD` | Yes* | — | SMTP credential |
| `NODE_ENV` | No | `development` | `production` disables dev tooling |
| `PORT` | No | `8080` | Backend HTTP port |
| `CORTEX_OPEN_DEVTOOLS` | No | — | Set to `1` to open DevTools on launch |

---

## Architecture

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full design rationale.

```text
┌────────────────────────────────────────────────────┐
│                  Electron Window                   │
│                                                    │
│  ┌─────────────────────────────────────────────┐   │
│  │         React Renderer (UI)                 │   │
│  │  AuthPortal | SearchTab | NotesTab | ...    │   │
│  └────────┬───────────────┬────────────────────┘   │
│           │ IPC (invoke)  │ fetch (REST)            │
│           │               │                        │
│  ┌────────▼──────────┐    │                        │
│  │  Electron Main    │    │                        │
│  │  (main.js)        │    │                        │
│  │  ┌─────────────┐  │    │                        │
│  │  │ SQLite DB   │  │    │                        │
│  │  │ (offline)   │  │    │                        │
│  │  ├─────────────┤  │    │                        │
│  │  │ BGE ONNX    │  │    │                        │
│  │  │ (embeddings)│  │    │                        │
│  │  ├─────────────┤  │    │                        │
│  │  │electron-    │  │    │                        │
│  │  │store (tokens│  │    │                        │
│  │  │encrypted)   │  │    │                        │
│  │  └─────────────┘  │    │                        │
│  └───────────────────┘    │                        │
└───────────────────────────┼────────────────────────┘
                            │ HTTP REST
               ┌────────────▼────────────────┐
               │  Express Backend (apps/server/)│
               │  localhost:8080              │
               ├─────────────────────────────┤
               │  /auth   — signup, login,   │
               │            refresh, logout  │
               │  /reference — districts,    │
               │              colleges, etc. │
               │  /health — liveness probe   │
               └────────────┬────────────────┘
                            │ pg
               ┌────────────▼────────────────┐
               │  PostgreSQL (Supabase)       │
               │  users, sessions, tokens,   │
               │  reference data             │
               └─────────────────────────────┘
```

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: add X'`
4. Push and open a Pull Request

---

## License

[MIT](./LICENSE) © 2026 Surya Hariharan

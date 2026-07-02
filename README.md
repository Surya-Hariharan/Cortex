# Cortex — Offline-First AI Productivity Platform

> A private AI second-brain for students. Semantic search over your own documents,
> structured notes, and local peer sharing — all running on your device. **No cloud,
> no backend, no account server required** — an optional cloud backend exists for
> cross-device sync and collaboration, but the app is fully functional without it.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
![Database](https://img.shields.io/badge/database-Supabase-success)
![Email](https://img.shields.io/badge/email-MailerLite-brightgreen)
![Status](https://img.shields.io/badge/status-beta-orange)

---

## Features

- **Semantic Search** — Vector search over uploaded PDFs and notes using BGE
  embeddings (ONNX, runs fully locally)
- **RAG Answers** — AI-synthesized answers from your documents via a local LLM
  (Phi-3 / Ollama), with an optional Gemini fallback when online
- **Notes & Deadlines** — Note-taking with task, deadline, and idea categories
  stored in local SQLite
- **Local Auth** — Signup/login handled entirely on-device with bcrypt; your data
  never leaves your machine
- **Offline Mesh Network** — Share documents with nearby peers over LAN (mDNS peer
  discovery) — experimental
- **Native Desktop App** — Built with Electron; installs and runs like VS Code or
  Notion
- **Robust Cloud Infrastructure** — Optional but fully featured cloud sync backed by **Supabase** (managed PostgreSQL & Auth) and **MailerLite** (transactional emails).

Cortex is **local-first**: the core experience works with zero internet and no
external services. Connectivity only unlocks optional enhancements (e.g. the Gemini
AI fallback).

---

## Project Structure

```text
Cortex/
├── apps/
│   ├── desktop/                # Electron desktop app (the whole application)
│   │   ├── config/             # webpack, tailwind, postcss configs
│   │   ├── src/
│   │   │   ├── main/           # Electron main process + preload (IPC)
│   │   │   ├── renderer/       # React UI
│   │   │   │   ├── components/ # pages/ · panels/ · layout/ · shared/ · editor/
│   │   │   │   ├── constants/  # static data
│   │   │   │   ├── context/    # React context providers
│   │   │   │   └── hooks/      # custom hooks
│   │   │   ├── services/       # ai/ · storage/ · network/ · mesh/ · offline/ · cloud/ · system/
│   │   │   └── __tests__/      # Vitest suites
│   │   └── package.json
│   └── server/                 # Optional cloud backend (Supabase auth/db, MailerLite email,
│       │                       #   sync, backup, collaboration)
│       ├── src/                # routes → controllers → services → repositories → db/config
│       ├── tests/
│       ├── docs/                # ARCHITECTURE, API, DATABASE, SECURITY, TESTING
│       └── package.json
├── docs/ARCHITECTURE.md        # Design rationale, IPC + data-flow diagrams
├── .github/workflows/ci.yml    # CI (test + build)
└── .env.example                # Optional environment variables
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full design rationale.

---

## Optional Cloud Backend

Cortex works fully offline with zero setup — the section above is the whole story for
most users. `apps/server` is a separate, opt-in service, backed by **Supabase** (managed
Postgres + Auth) and **MailerLite** (transactional email), that adds:

- Account-based auth via Supabase (sessions, password hashing, refresh-token rotation),
  email verification, password reset, device management, sign-out-everywhere, account deletion
- Cross-device sync (the server stores **encrypted blobs only** — it cannot read your notes)
- Encrypted cloud backup with manual/automatic snapshots and restore
- Collaboration: friend requests, shared workspaces, invitations, organizations
- Every account/collaboration/product email sent via MailerLite (retried, logged, never
  blocking — a MailerLite outage can't fail registration or login)

The desktop app never depends on it: it doesn't probe for it at startup, doesn't block on
it, and local login/signup (the default) is a completely separate code path. It only
activates if you set `CORTEX_CLOUD_API_URL` and explicitly connect a cloud account from the
**Cloud & Sync** tab in Settings. See [`apps/server/README.md`](apps/server/README.md) to run
it, [`apps/server/docs/ARCHITECTURE.md`](apps/server/docs/ARCHITECTURE.md) for the full design
(schema, RLS policies, API, security model, sequence diagrams), and
[`apps/server/docs/TESTING.md`](apps/server/docs/TESTING.md) for the test report and manual
verification checklist.

---

## Prerequisites

| Requirement | Version | Notes |
| --- | --- | --- |
| **Node.js** | ≥ 18 LTS (20 recommended) | [nodejs.org](https://nodejs.org) |
| **npm** | ≥ 9 | Bundled with Node |
| **Build tools** | — | Native modules (better-sqlite3, onnxruntime-node, bcrypt) are rebuilt for Electron; you need a working C/C++ toolchain (Xcode CLT on macOS, `build-essential` on Linux, Build Tools for Visual Studio on Windows) |

No database, no Docker, no API keys are required.

---

## Setup

### 1. Clone and enter the desktop app

```bash
git clone https://github.com/yourname/cortex.git
cd cortex/apps/desktop
```

### 2. (Optional) Configure environment variables

Everything has safe defaults. If you want to set the encrypted-store key or enable
optional features, copy the template from the repo root:

```bash
cp ../../.env.example ../../.env
```

The root `.env` is loaded by the Electron main process. All variables are optional —
see the [Environment Variables](#environment-variables) section.

### 3. Install dependencies and rebuild native modules

```bash
npm install
npm run rebuild        # Recompiles better-sqlite3, onnxruntime-node, bcrypt for Electron's ABI
```

`npm run rebuild` is required after `npm install` and after upgrading Electron. Skip
it and you'll get a "NODE_MODULE_VERSION mismatch" error at startup.

### 4. Build the renderer

```bash
npm run build          # Webpack compiles the React app into dist/renderer/
```

### 5. Launch the app

```bash
npm start
```

Electron opens the app window. If a session exists from a previous login it loads the
main UI directly; otherwise it shows the auth page.

---

## Development Mode

Run the renderer in watch mode (hot reload) with Electron:

```bash
cd apps/desktop
npm run dev
```

---

## AI Models (optional — for semantic search and RAG)

Semantic search and RAG answers use the BGE embeddings model; the LLM is needed only
for AI-generated answers. Without any model configured, the app still works fully for
auth, notes, and PDF storage.

### Option A — Ollama (recommended for the local LLM)

```bash
# Install from https://ollama.com, then:
ollama pull phi3
```

Cortex detects a running Ollama instance automatically.

### Option B — ONNX models (fully offline, no network)

Download and place these directories under `apps/desktop/models/` (or Electron's
`userData/models/`):

| Directory | Size | Purpose |
| --- | --- | --- |
| `bge-small-en-v1.5/` | ~126 MB | Embeddings (semantic search) |
| `phi-3-mini/` | ~2.4 GB | LLM text generation (RAG answers) |

### Option C — Gemini API fallback (online only)

Set `GEMINI_API_KEY` in the root `.env`. Cortex falls back to the Gemini API if no
local model is found and the machine is online.

---

## Running Tests

```bash
cd apps/desktop
npm test               # Vitest, with coverage

# Optional cloud backend
cd apps/server
npm test               # Vitest — mocked, no live Supabase/MailerLite required
```

---

## Environment Variables

All variables are **optional** and read by the Electron main process from the root
`.env`. See [`.env.example`](./.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` disables dev tooling |
| `CORTEX_OPEN_DEVTOOLS` | — | Set to `1` to open DevTools on launch |
| `GEMINI_API_KEY` | — | Enables the online Gemini AI fallback |
| `CORTEX_MESH_EXPERIMENTAL` | — | Set to `1` to enable experimental LAN peer discovery |
| `CORTEX_CLOUD_API_URL` | — | Base URL of a running `apps/server` instance — enables the optional Cloud & Sync account features. See [Optional Cloud Backend](#optional-cloud-backend) |

---

## Contributing

We welcome contributions from the community! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started.

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

To see what has changed recently in Cortex, please review the [Changelog](./CHANGELOG.md).

---

## License

[MIT](./LICENSE) © 2026 Surya Hariharan

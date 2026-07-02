# Cortex — Offline-First AI Productivity Platform

> A private AI second-brain for students. Semantic search over your own documents,
> structured notes, and local peer sharing — all running on your device. **No cloud,
> no backend, no account server required.**

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Node](https://img.shields.io/badge/node-%3E%3D18-green)
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

Cortex is **local-first**: the core experience works with zero internet and no
external services. Connectivity only unlocks optional enhancements (e.g. the Gemini
AI fallback).

---

## Project Structure

```text
Cortex/
├── apps/
│   └── desktop/                # Electron desktop app (the whole application)
│       ├── config/             # webpack, tailwind, postcss configs
│       ├── src/
│       │   ├── main/           # Electron main process + preload (IPC)
│       │   ├── renderer/       # React UI
│       │   │   ├── components/ # pages/ · panels/ · layout/ · shared/ · editor/
│       │   │   ├── constants/  # static data
│       │   │   ├── context/    # React context providers
│       │   │   └── hooks/      # custom hooks
│       │   ├── services/       # ai/ · storage/ · network/ · mesh/ · offline/ · system/
│       │   └── __tests__/      # Vitest suites
│       └── package.json
├── docs/ARCHITECTURE.md        # Design rationale, IPC + data-flow diagrams
├── .github/workflows/ci.yml    # CI (test + build)
└── .env.example                # Optional environment variables
```

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full design rationale.

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
```

---

## Environment Variables

All variables are **optional** and read by the Electron main process from the root
`.env`. See [`.env.example`](./.env.example).

| Variable | Default | Purpose |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` disables dev tooling and requires `CORTEX_STORE_KEY` |
| `CORTEX_STORE_KEY` | dev fallback | Encrypts the electron-store token/session file (required in production) |
| `CORTEX_OPEN_DEVTOOLS` | — | Set to `1` to open DevTools on launch |
| `GEMINI_API_KEY` | — | Enables the online Gemini AI fallback |
| `CORTEX_MESH_EXPERIMENTAL` | — | Set to `1` to enable experimental LAN peer discovery |

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: add X'`
4. Push and open a Pull Request

---

## License

[MIT](./LICENSE) © 2026 Surya Hariharan

# Cortex — Offline AI Productivity Platform

> A private, fully offline AI second-brain for students. Runs 100% on your device — no cloud, no subscriptions, no tracking.

![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
![Status](https://img.shields.io/badge/status-active-success)

---

## Features

- **Semantic Search** — Vector-based search across your uploaded PDFs and notes using BGE embeddings
- **RAG Answers** — AI-synthesized answers from your documents via local Phi-3 LLM
- **Notes & Deadlines** — Structured note-taking with task, deadline, and idea categories
- **Offline Mesh Network** — Share documents with nearby peers over LAN (libp2p)
- **Native Desktop App** — Built with Electron; runs as a standalone app like VS Code or Notion
- **Zoom Support** — `Ctrl +` / `Ctrl -` / `Ctrl 0` and mouse wheel zoom

---

## Project Structure

```
Cortex/
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.js         # App entry — thin shell, loads Express backend
│   │   └── preload.js      # Context bridge (IPC)
│   ├── renderer/           # React frontend
│   │   ├── App.jsx
│   │   ├── index.jsx / index.css / index.html
│   │   └── components/     # SearchTab, NotesTab, NetworkTab, PerformanceTab, ...
│   └── services/           # Legacy service layer (still used by scripts)
│       ├── database.js
│       ├── embeddings.js
│       └── ...
├── backend/
│   ├── server.js           # Express entry point (port 3001)
│   └── src/
│       ├── ai/             # BGE embeddings, Phi-3 LLM, RAG pipeline
│       ├── auth/           # JWT + OTP authentication
│       ├── core/           # Express app bootstrap + routes
│       ├── mesh/           # libp2p P2P networking
│       └── storage/        # SQLite (better-sqlite3) + LanceDB vector store
├── scripts/
│   └── setup-demo.js       # Seed sample data for testing
├── data/                   # Runtime: SQLite DB + LanceDB vectors (gitignored)
├── models/                 # AI models — download separately (gitignored)
├── dist/                   # Webpack build output (gitignored)
├── .env.example            # Environment variable template
├── package.json
├── webpack.config.js
└── tailwind.config.js
```

---

## Setup

### Prerequisites

- Node.js ≥ 18
- Windows 10+ / macOS 12+ / Ubuntu 20+
- ~4 GB RAM minimum (8 GB recommended for LLM)

### Install

```bash
git clone https://github.com/yourname/cortex.git
cd cortex
npm install
npm run rebuild          # recompile native modules for Electron
```

### Download AI Models

Place the following in the `models/` directory:

| Model | Size | Purpose |
|-------|------|---------|
| `bge-small-en-v1.5/` | ~126 MB | Semantic embeddings |
| `Phi-3-mini-4k-instruct/` | ~2.4 GB | LLM text generation |

### Configure

```bash
cp .env.example .env
# Edit .env with your SMTP credentials (optional — needed for auth emails)
```

### Run

```bash
npm run dev
```

The Electron window opens, shows a loading screen while the backend starts, then loads the React UI.

### Build for Distribution

```bash
npm run build
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build frontend + start backend + launch Electron |
| `npm run build` | Build the Webpack bundle only |
| `npm run rebuild` | Recompile native modules for Electron's Node version |
| `npm run setup` | Full install + rebuild from scratch |

---

## Architecture

```
┌─────────────────────────────────────────┐
│           Electron Window               │
│  ┌─────────────────────────────────┐   │
│  │   React UI (localhost:3001)     │   │
│  │   SearchTab | NotesTab | ...    │   │
│  └──────────────┬──────────────────┘   │
│                 │ HTTP API              │
└─────────────────┼───────────────────── ┘
                  │
    ┌─────────────▼────────────────┐
    │     Express Backend          │
    │     (Node.js, port 3001)     │
    ├──────────────────────────────┤
    │  Auth │ AI │ Storage │ Mesh  │
    │  JWT  │BGE │SQLite   │libp2p │
    │       │Phi3│LanceDB  │       │
    └──────────────────────────────┘
```

- **Electron main process** — creates the window, handles zoom
- **Express backend** — all data and AI operations (runs separately)
- **React frontend** — served by Express, communicates via HTTP and IPC

---

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: add X'`
4. Push and open a Pull Request

---

## License

[MIT](./LICENSE) © 2026 Surya Hariharan

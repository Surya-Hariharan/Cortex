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

```text
Cortex/
├── frontend/
│   ├── src/
│   │   ├── main/           # Electron main process (spawns Python backend)
│   │   │   ├── main.js
│   │   │   └── preload.js  # Context bridge (IPC)
│   │   └── renderer/       # React frontend UI
│   └── package.json        
├── app/                    # Python FastAPI Backend
│   ├── main.py             # Entry point (port 8765)
│   ├── api/                # REST API Routes
│   ├── ai_models/          # Local ONNX models + Ollama + Gemini API fallbacks
│   ├── database/           # SQLite + SQLAlchemy ORM
│   ├── mesh_network/       # mDNS and WebSocket P2P networking
│   └── rag/                # FAISS vector store integration
├── data/                   # Runtime: SQLite DB + FAISS vectors (auto-generated)
├── models/                 # Local AI models (download separately, or use Gemini API)
├── .env.example            # Environment variable template
└── requirements.txt        # Backend dependencies
```

---

## Setup

### Prerequisites

- Node.js ≥ 18
- Python 3.10+
- Windows 10+ / macOS 12+ / Linux
- ~4 GB RAM minimum (8 GB recommended for local LLM)

### Install

```bash
git clone https://github.com/yourname/cortex.git
cd cortex

# 1. Setup Python Backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt

# 2. Setup Frontend
cd frontend
npm install
```

### Download AI Models

Cortex supports running AI locally entirely offline. You have three options:

**Option A: Ollama (Recommended for LLM)**
Ollama is the easiest way to run local LLMs. It exposes a local API that Cortex will automatically detect and use.

1. Download Ollama from [ollama.com](https://ollama.com)
2. Open your terminal and pull the local model:

   ```bash
   ollama pull phi3
   ```

Cortex will automatically route LLM text generation to your local Ollama instance if it detects it running.

**Option B: ONNX Models (Offline Fallback)**
Place the following in the `models/` directory.

| Model                | Size    | Purpose                      |
|----------------------|---------|------------------------------|
| `bge-small-en-v1.5/` | ~126 MB | Semantic embeddings (Search) |
| `phi-3-mini/`        | ~2.4 GB | LLM text generation (RAG)    |

**Option C: Cloud AI (Online Fallback)**
If you choose not to download these large local models, the application will automatically fall back to using the Gemini API if a `GEMINI_API_KEY` is provided in your environment variables.

### Configure

```bash
cp .env.example .env
# Edit .env to set your GEMINI_API_KEY if you are not using local models.
# By default, Cortex uses a local SQLite database for offline-first capabilities.
```

### Run

```bash
cd frontend
npm run dev
```

The Electron window opens, automatically starting the Python backend dynamically.

### Build for Distribution

```bash
cd frontend
npm run build
```

---

## Architecture

```text
┌─────────────────────────────────────────┐
│           Electron Window               │
│  ┌─────────────────────────────────┐    │
│  │   React UI (Frontend)           │    │
│  │   SearchTab | NotesTab | ...    │    │
│  └──────────────┬──────────────────┘    │
│                 │ HTTP / REST API       │
└─────────────────┼───────────────────── ┘
                  │
    ┌─────────────▼────────────────┐
    │     Python FastAPI Backend   │
    │     (Localhost:8765)         │
    ├──────────────────────────────┤
    │  API │ AI │ Storage │ Mesh   │
    │      │BGE │SQLite   │mDNS    │
    │      │Phi3│FAISS    │WebSock │
    └───────┬──────────────────────┘
            │
      [Optional Cloud Fallback]
      Gemini API (Embeddings & LLM)
```

- **Electron main process** — manages the app lifecycle and window.
- **Python FastAPI backend** — handles AI orchestration, RAG pipelines, SQLite database operations, and networking.
- **React frontend** — interface that runs within the Electron renderer.

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit: `git commit -m 'feat: add X'`
4. Push and open a Pull Request

---

## License

[MIT](./LICENSE) © 2026 Surya Hariharan

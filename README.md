# Cortex

**Offline AI productivity platform for students.** Runs entirely on-device — no cloud, no internet required.

## Features

- **Semantic Search** — Natural language search over PDFs using local ONNX embeddings
- **RAG with Citations** — Synthesized answers with inline source references
- **Notes & Deadlines** — Encrypted notes, tasks, and deadline tracking
- **Mesh Networking** — Peer discovery and document sharing over LAN (libp2p)
- **Performance Dashboard** — Live benchmarking with DirectML vs CPU comparison
- **Fully Offline** — Bundled fonts, local models, zero CDN dependencies, no build step

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
# → http://localhost:3001
```

## Project Structure

```
cortex/
├── backend/
│   ├── server.js           ← Express API server + static file serving
│   └── services/           ← AI runtime, database, PDF handler, mesh
├── frontend/
│   └── public/             ← Static web app (vanilla HTML/CSS/JS)
│       ├── index.html      ← Single-page app shell
│       ├── css/styles.css   ← All styles (design tokens, animations)
│       └── js/             ← ES modules (api, app, search, notes, etc.)
├── models/                 ← ONNX model files (BGE-small-en-v1.5)
├── data/                   ← SQLite database + LanceDB vectors (gitignored)
├── .env                    ← Environment config (copy from .env.example)
├── .env.example            ← Config template with documentation
└── package.json            ← Dependencies and scripts
```

## Tech Stack

| Layer           | Technology                              |
|-----------------|----------------------------------------|
| Server          | Express 5 (Node.js ≥18)               |
| Frontend        | Vanilla HTML/CSS/JS (ES modules)       |
| AI Runtime      | ONNX Runtime + DirectML                |
| Embedding Model | BGE-small-en-v1.5 (384d, 22MB)        |
| Database        | SQLite (better-sqlite3) + AES-256-GCM |
| Vector Store    | LanceDB                               |
| Peer Network    | libp2p (TCP + mDNS)                   |

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable          | Default              | Description                    |
|-------------------|----------------------|--------------------------------|
| `PORT`            | `3001`               | Server port                    |
| `NODE_ENV`        | `production`         | Environment mode               |
| `DATA_DIR`        | `./data`             | Database & vector storage path |
| `MODELS_DIR`      | `./models`           | ONNX model files path         |
| `MESH_ENABLED`    | `true`               | Enable libp2p mesh networking  |
| `MESH_PORT`       | `62222`              | Mesh TCP listener port         |
| `EMBEDDING_MODEL` | `bge-small-en-v1.5`  | Embedding model name           |

## AMD / DirectML

- DirectML execution provider accelerates embedding inference on AMD Ryzen AI hardware
- Auto-detects NPU/iGPU; falls back to CPU on unsupported hardware
- Up to 3× faster inference on Ryzen AI vs CPU-only
- Real-time provider status shown in the Performance tab

## License

[MIT](LICENSE)

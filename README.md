# Cortex

Offline AI productivity platform for students. Runs entirely on-device — no cloud, no internet required.

## Quick Start

```bash
npm install
npx electron-rebuild
npm run setup-demo
npm start
```

## Screenshots

**Semantic Search** — query your document library and get AI-synthesized answers with citations

![](<Mockframes/Screenshot 2026-03-01 092729.png>)

**Notes & Deadlines** — encrypted notes, tasks, and deadline tracking with due date indicators

![](<Mockframes/Screenshot 2026-03-01 092824.png>)

**Performance Dashboard** — live embed latency benchmarks with DirectML vs CPU comparison

![](<Mockframes/Screenshot 2026-03-01 092907.png>)

## Features

- **Semantic Search** — Natural language search over PDFs using local ONNX embeddings
- **RAG with Citations** — Synthesized answers with inline source references
- **Notes & Deadlines** — Encrypted notes, tasks, and deadline tracking
- **LAN Peer Discovery** — Real UDP broadcast discovery of peers on the same network
- **Performance Dashboard** — Live benchmarking with DirectML vs CPU comparison
- **Fully Offline** — Bundled fonts, local model, zero CDN dependencies

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Electron 28 + React 18 |
| AI Runtime | ONNX Runtime + DirectML |
| Model | BGE-small-en-v1.5 (384d, 22MB) |
| Database | SQLite + AES-256-GCM encryption |
| Peer Discovery | UDP Broadcast on port 41234 |

## AMD

- DirectML execution provider accelerates embedding inference on AMD Ryzen AI hardware
- Auto-detects NPU/iGPU; falls back to CPU on unsupported hardware
- Up to 3x faster inference on Ryzen AI vs CPU-only
- Real-time provider status shown in the Performance tab


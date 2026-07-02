# Cortex — Architecture & Design Decisions

This document explains the major architectural choices in Cortex, the trade-offs
considered, and why the current design was selected over alternatives.

Cortex is a **fully local-first** Electron desktop application. There is no backend
server, no cloud database, and no network dependency for the core experience —
everything runs in the Electron process on the user's device.

---

## Table of Contents

1. [Why local-first (no backend)](#why-local-first-no-backend)
2. [Why Electron and not a web app](#why-electron-and-not-a-web-app)
3. [Why SQLite for local data](#why-sqlite-for-local-data)
4. [Offline-first design philosophy](#offline-first-design-philosophy)
5. [IPC architecture](#ipc-architecture)
6. [Authentication architecture](#authentication-architecture)
7. [Data flow summary](#data-flow-summary)
8. [Project structure](#project-structure)

---

## Why local-first (no backend)

Cortex previously shipped with an Express/Postgres backend for authentication and
reference data. That backend has been **removed**. The application now runs entirely
in the Electron main process:

- **Auth** is handled locally with `bcrypt` against a `users` table in the local
  SQLite database (see [Authentication architecture](#authentication-architecture)).
- **Documents, notes, embeddings** live in local SQLite.
- **AI** (embeddings + RAG) runs in-process via `onnxruntime-node`.

**Why this is the right fit:**

- **Zero setup.** No connection string, no server process, no ports, no external
  service to provision. The app works on first launch, offline.
- **Privacy.** A student's notes and documents never leave their machine.
- **One runtime.** The Electron shell is already a Node.js process, so all logic
  lives in one language and one dependency graph — no fragile Python/Express
  subprocess lifecycle to manage.

**Trade-off accepted:** features that inherently need a server — cross-device sync
and email-based password reset — are not available in local-first mode. The auth IPC
handlers return an explicit "not available" response for password reset rather than
pretending to support it. Cross-device sync is a candidate for a future, optional
add-on that would not compromise the offline core.

---

## Why Electron and not a web app

Cortex's core value proposition is offline-first, local AI. That requires:

1. **Filesystem access** — reading PDFs, writing the SQLite database, storing ONNX
   model weights. Browser web apps can only touch files opened via a picker.
2. **Native Node.js addons** — `onnxruntime-node`, `better-sqlite3`, and `bcrypt`
   are native C++ modules that do not run in a browser sandbox.
3. **LAN discovery without a server** — mDNS peer discovery uses UDP multicast,
   which browsers cannot send.
4. **Encrypted local storage** — `electron-store` with an encryption key keeps auth
   state off disk in plaintext; `localStorage` is not encrypted.
5. **No phone-home requirement** — offline mode must work with zero internet, which
   means shipping the runtime with the app rather than depending on a cloud host.

**Alternative considered — Tauri.** Smaller binaries (~10 MB vs ~150 MB), but
`onnxruntime-node` has no Rust bindings at the time of writing, and rebuilding the ML
pipeline in Rust was out of scope. Worth revisiting once the AI layer is stable.

**Alternative considered — VS Code extension.** Extensions share a browser's security
constraints: no arbitrary filesystem access, no native addons. Not viable.

---

## Why SQLite for local data

The Electron main process uses SQLite (via `better-sqlite3`) for **all** persistent
data: users, documents, embeddings, notes, deadlines, and pages.

- **Zero-config, zero-infrastructure.** A single file in the user's `userData`
  directory (`app.getPath('userData')/cortex.db`). No server, no ports.
- **ACID transactions.** Full ACID guarantees for concurrent writes from multiple IPC
  handlers — unlike JSON files or `localStorage`.
- **Embedding storage.** Cosine-similarity vector search over float32 arrays is
  implemented on top of SQLite BLOB columns, avoiding a separate FAISS process while
  comfortably handling a personal knowledge base (< 100k chunks).

**Trade-off accepted:** SQLite has no full-text search wired up (FTS5 is available but
unused). Semantic search via embeddings is used instead, which serves the use case
better anyway.

---

## Offline-first design philosophy

Cortex treats internet connectivity as an enhancement, not a requirement.

| Feature | Offline | Online |
| --- | --- | --- |
| Document upload + indexing | Yes (local SQLite + ONNX) | Yes |
| Semantic search | Yes (local BGE embeddings) | Yes |
| Notes / deadlines | Yes (local SQLite) | Yes |
| Auth (login / signup) | Yes (local bcrypt + SQLite) | Yes |
| Peer LAN sharing | Yes (mDNS, no internet) | Yes |
| AI answers (RAG) | Yes (local Phi-3 / Ollama) | Yes + optional Gemini fallback |
| Password reset | Not available in local-first mode | — |
| Cross-device sync | Not available in local-first mode | — |

**How offline detection works:** the Electron main process probes three public
endpoints (`1.1.1.1`, `cloudflare.com`, `google.com`) via HTTP HEAD on an interval.
A hysteresis threshold of 3 consecutive failures is required before marking the app
offline, preventing flicker during brief packet loss. The status is broadcast to the
renderer so the UI can show an offline badge. Connectivity only affects optional
enhancements (e.g. the Gemini fallback) — never the core experience.

---

## IPC architecture

Electron enforces a security boundary between the main process (Node.js, full OS
access) and the renderer (sandboxed Chromium). All communication crosses this boundary
via IPC — there is no other channel out of the renderer.

```text
┌─────────────────────────────────────────────────────────────┐
│                      Electron Window                        │
│                                                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │                  React Renderer                    │     │
│  │                                                    │     │
│  │  window.electronAPI.search(query)                  │     │
│  │  window.electronAPI.uploadPdf(userId)              │     │
│  │  window.electronAPI.addNote(note)                  │     │
│  │  window.electronAPI.authLogin({ email, password }) │     │
│  │  window.electronAPI.saveSession(profile)           │     │
│  │  ...                                               │     │
│  └──────────────────────┬─────────────────────────────┘     │
│                         │  contextBridge (preload.js)        │
│                         │  ipcRenderer.invoke / .send        │
│  ┌──────────────────────▼─────────────────────────────┐     │
│  │                   Main Process (main.js)           │     │
│  │                                                    │     │
│  │  ipcMain.handle('auth-register'|'auth-login', ...) │     │
│  │    → bcrypt.hash / bcrypt.compare (rounds = 12)    │     │
│  │    → db.createUser / db.getUserByEmail            │     │
│  │                                                    │     │
│  │  ipcMain.handle('search', ...)                     │     │
│  │    → ragSearch(query, embeddingsEngine, db)        │     │
│  │                                                    │     │
│  │  ipcMain.handle('upload-pdf', ...)                 │     │
│  │    → dialog.showOpenDialog()                       │     │
│  │    → extractPdfText() → db.insertDocument()        │     │
│  │    → embeddingsEngine.embed() → db.insertEmbedding │     │
│  │                                                    │     │
│  │  ┌──────────────┐  ┌───────────────┐  ┌─────────┐ │     │
│  │  │  SQLite DB   │  │  BGE ONNX     │  │electron-│ │     │
│  │  │  users,docs, │  │  embeddings   │  │store    │ │     │
│  │  │  notes,pages,│  │  (in-process) │  │(session,│ │     │
│  │  │  embeddings  │  │               │  │encrypted│ │     │
│  │  └──────────────┘  └───────────────┘  └─────────┘ │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘

           No network dependency — everything above runs on-device.
   Optional: mDNS LAN peer discovery, and a Gemini API fallback for AI.
```

**Security properties of the IPC layer:**

- `contextIsolation: true` — the renderer cannot access Node.js APIs directly.
- `nodeIntegration: false` — `require()` is not available in the renderer.
- The `contextBridge` in `preload.js` is the only surface the renderer can call.
  Every exported function is an explicit allowlist — there is no generic IPC
  passthrough.

---

## Authentication architecture

All authentication is local. There are no JWTs, no Postgres, and no SMTP.

```text
Signup / Login flow (fully local)
─────────────────────────────────
Renderer → services/api.js  auth.signup|login(payload)
         → window.electronAPI.authRegister|authLogin(payload)
              → ipcMain 'auth-register' | 'auth-login'
                   register: db.getUserByEmail(email)  (reject if exists)
                             bcrypt.hash(password, 12)
                             db.createUser(email, hash, full_name)
                   login:    db.getUserByEmail(email)
                             bcrypt.compare(password, user.password_hash)
              → { status: 200, data: { user, accessToken, refreshToken } }
                (tokens are local placeholders; there is no remote session)
Renderer ← response
         → localStorage.setItem('cortex-auth-profile', { id, email, ... })
           (profile only — NO password hash)
         → window.electronAPI.saveSession(...)  persists across restarts

Password reset
──────────────
Not supported in local-first mode. The 'auth-forgot-password' and
'auth-reset-password' IPC handlers return an explicit
{ status: 400, detail: '... not available in local-first mode' }.
```

Because the user database lives on-device and is never exposed over a network, there
is no external attack surface for the auth layer — the threat model is limited to
someone with physical/filesystem access to the machine.

---

## Data flow summary

```text
User uploads a PDF
──────────────────
Renderer → electronAPI.uploadPdf()  → IPC 'upload-pdf'
         → dialog.showOpenDialog() → path
         → extractPdfText(path) → chunks[]
         → for each chunk:
              db.insertDocument(...) → docId
              embeddingsEngine.embed(content) → float32 vector
              db.insertEmbedding(docId, vector)
         → { success: true, chunks: N }

User searches
─────────────
Renderer → electronAPI.search(query)  → IPC 'search'
         → embeddingsEngine.embed(query) → queryVector
         → ragSearch(): cosineSimilarity over stored embeddings → top-K
         → db.getDocumentsByIds(top-K) → chunks
         → (optional) LLM synthesis → answer
         → { results: [...] }

User adds a note
────────────────
Renderer → electronAPI.addNote({ title, content, type, dueDate })
         → IPC 'add-note' → db.addNote(...) → { success: true, id }
```

---

## Project structure

```text
Cortex/
├── apps/
│   └── desktop/                 # The Electron application
│       ├── config/              # webpack / tailwind / postcss configs
│       ├── src/
│       │   ├── main/            # Electron main process + preload
│       │   ├── renderer/        # React UI
│       │   │   ├── components/
│       │   │   │   ├── pages/   # Full-screen views
│       │   │   │   ├── panels/  # Tab/panel widgets embedded in pages
│       │   │   │   ├── layout/  # App shell (window controls, toasts, modals)
│       │   │   │   ├── shared/  # Reusable building blocks
│       │   │   │   └── editor/  # Rich-text editor
│       │   │   ├── constants/   # Static data (e.g. authData.js)
│       │   │   ├── context/     # React context providers
│       │   │   └── hooks/       # Custom React hooks
│       │   ├── services/        # Non-UI logic
│       │   │   ├── ai/          # embeddings, vectorSearch, ragPipeline
│       │   │   ├── storage/     # database, encryption, keyStore, tokenStore, pdfHandler
│       │   │   ├── network/     # peerDiscovery (mDNS)
│       │   │   ├── mesh/        # meshController
│       │   │   ├── offline/     # offline identity
│       │   │   ├── system/      # device capability
│       │   │   └── api.js       # renderer-facing facade over IPC
│       │   └── __tests__/       # Vitest suites
│       └── package.json
├── docs/                        # This document
├── .github/workflows/           # CI
└── README.md
```

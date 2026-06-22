# Cortex — Architecture & Design Decisions

This document explains the major architectural choices in Cortex, the trade-offs considered, and why the current design was selected over alternatives.

---

## Table of Contents

1. [Why Express and not FastAPI](#why-express-and-not-fastapi)
2. [Why Electron and not a web app](#why-electron-and-not-a-web-app)
3. [Why SQLite for local data](#why-sqlite-for-local-data)
4. [Offline-first design philosophy](#offline-first-design-philosophy)
5. [IPC architecture](#ipc-architecture)
6. [Authentication architecture](#authentication-architecture)
7. [Data flow summary](#data-flow-summary)

---

## Why Express and not FastAPI

The project started with a Python FastAPI backend for AI model serving (ONNX, Ollama, FAISS). When the scope expanded to include multi-device auth, per-email rate limiting, JWT session management, and a typed REST API for reference data, the Python backend became a poor fit for two reasons:

**Reason 1 — shared runtime with the frontend.** The Electron shell is already a Node.js process. Keeping the backend in JavaScript means one language, one dependency graph, and one set of build tools. Running a Python subprocess from Electron (the original design) required spawning a child process, waiting for it to bind, and tearing it down on quit — a fragile lifecycle that broke silently on Windows when the Python path was wrong.

**Reason 2 — auth complexity in Python without a framework.** FastAPI is excellent for ML serving but does not include the batteries (bcrypt, JWT, Helmet, per-IP/per-email rate limiting, Zod validators) that Express ecosystems provide out of the box. Replicating those in Python would have been more work than migrating the API layer to Express.

**What FastAPI still does well here:** the ONNX embeddings engine and RAG pipeline remain in-process in the Electron main process via `onnxruntime-node`. There is no Python process at runtime in the current design — models run as native Node.js addons.

**Trade-off accepted:** Express has less built-in type safety than FastAPI's Pydantic. This is mitigated with Zod validators on every route and Jest tests that exercise the validator layer independently of the service layer.

---

## Why Electron and not a web app

Cortex's core value proposition is offline-first, local AI. That requires:

1. **Access to the filesystem** — reading PDFs, writing the SQLite database, storing ONNX model weights. Browser-based web apps can only access files the user explicitly opens via a file picker.

2. **Native Node.js addons** — `onnxruntime-node`, `better-sqlite3`, and `bcrypt` are native C++ modules that do not run in a browser sandbox.

3. **LAN discovery without a server** — mDNS peer discovery sends and receives UDP multicast packets, which browsers cannot do.

4. **Encrypted local storage** — `electron-store` with an encryption key keeps auth tokens off disk in plaintext. `localStorage` is not encrypted.

5. **No phone-home requirement** — a web app requires a server. Cortex's offline mode must work with zero internet, which means shipping the runtime with the app rather than depending on a cloud host.

**Alternative considered — Tauri.** Tauri (Rust backend, WebView frontend) would produce smaller binaries (~10 MB vs ~150 MB for Electron). It was rejected because `onnxruntime-node` has no Rust bindings at the time of writing, and rebuilding the ML pipeline in Rust was out of scope. Tauri remains worth revisiting in a future version once the AI layer is stable.

**Alternative considered — VS Code extension.** Extensions run inside VS Code's renderer process and share the same security constraints as a browser. No filesystem access beyond the VS Code API, no native addons. Not viable.

---

## Why SQLite for local data

The Electron main process uses SQLite (via `better-sqlite3`) for all local, offline data: documents, embeddings, notes, deadlines.

**Reasons:**

- **Zero-config, zero-infrastructure.** SQLite is a single file in the user's `userData` directory. No connection string, no server process, no ports. Works on first launch with no setup.
- **ACID transactions.** Unlike storing data in JSON files or `localStorage`, SQLite gives full ACID guarantees for concurrent writes from multiple IPC handlers.
- **Embedding storage.** FAISS-style vector search (cosine similarity over float32 arrays) is implemented on top of SQLite BLOB columns. This avoids a FAISS process dependency while supporting document counts typical for a personal knowledge base (< 100k chunks).
- **Sync-friendly.** The local SQLite file can be shipped as an attachment or compared against a remote Postgres snapshot during a future cloud-sync feature. Row-level UUIDs make conflict resolution tractable.

**Trade-off accepted:** SQLite does not support full-text search out of the box (FTS5 extension is available but not yet wired up). Semantic search via embeddings is used instead, which serves the use case better anyway.

**Postgres is used separately** for the auth backend (users, sessions, refresh tokens, password reset tokens, reference data). This is intentional: auth data is shared across devices and requires ACID guarantees with concurrent writers; local document data is per-device and does not.

---

## Offline-first design philosophy

Cortex treats internet connectivity as an enhancement, not a requirement.

**The contract:**

| Feature | Offline | Online |
| --- | --- | --- |
| Document upload + indexing | Yes (local SQLite + ONNX) | Yes |
| Semantic search | Yes (local BGE embeddings) | Yes |
| Notes / deadlines | Yes (local SQLite) | Yes |
| Peer LAN sharing | Yes (mDNS, no internet) | Yes |
| Auth (login / signup) | No — requires Postgres | Yes |
| Forgot-password OTP | No — requires SMTP | Yes |
| AI answers (RAG) | Yes (local Phi-3 or Ollama) | Yes + Gemini fallback |

**How offline detection works:**

The Electron main process probes three public endpoints (`1.1.1.1`, `cloudflare.com`, `google.com`) via HTTP HEAD every 10 seconds. A hysteresis threshold of 3 consecutive failures is required before marking the app offline, preventing flickers during brief packet loss. The status is broadcast to the renderer via `ipcRenderer.on('internet-status', ...)` so the UI can show the offline badge.

**Local identity:** When the backend is unreachable, users who have previously authenticated can continue using local features. The session is persisted to `cortex-session.json` in Electron's `userData` directory (separate from `localStorage`, which is wiped on `BrowserWindow` reload).

---

## IPC architecture

Electron enforces a security boundary between the main process (Node.js, full OS access) and the renderer process (sandboxed Chromium). Communication crosses this boundary via IPC.

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
│  │  window.electronAPI.tokenSave(access, refresh)     │     │
│  │  window.electronAPI.authForgotPassword({ email })  │     │
│  │  ...                                               │     │
│  └──────────────────────┬─────────────────────────────┘     │
│                         │  contextBridge (preload.js)        │
│                         │  ipcRenderer.invoke / .send        │
│  ┌──────────────────────▼─────────────────────────────┐     │
│  │                   Main Process                     │     │
│  │                   (main.js)                        │     │
│  │                                                    │     │
│  │  ipcMain.handle('search', ...)                     │     │
│  │    → ragSearch(query, embeddingsEngine, db)        │     │
│  │                                                    │     │
│  │  ipcMain.handle('upload-pdf', ...)                 │     │
│  │    → dialog.showOpenDialog()                       │     │
│  │    → extractPdfText()                              │     │
│  │    → db.insertDocument()                           │     │
│  │    → embeddingsEngine.embed()                      │     │
│  │    → db.insertEmbedding()                          │     │
│  │                                                    │     │
│  │  ipcMain.handle('token-save', ...)                 │     │
│  │    → electron-store.set('accessToken', ...)        │     │
│  │       (AES-256 encrypted on disk)                  │     │
│  │                                                    │     │
│  │  ipcMain.handle('auth-forgot-password', ...)       │     │
│  │    → pg pool query (OTP hash stored in Postgres)   │     │
│  │    → nodemailer (OTP sent via SMTP)                │     │
│  │                                                    │     │
│  │  ┌──────────────┐  ┌───────────────┐              │     │
│  │  │  SQLite DB   │  │  electron-    │              │     │
│  │  │  (offline)   │  │  store        │              │     │
│  │  │  docs, notes │  │  (tokens,     │              │     │
│  │  │  embeddings  │  │  encrypted)   │              │     │
│  │  └──────────────┘  └───────────────┘              │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP REST (fetch from renderer)
                                │
               ┌────────────────▼────────────────┐
               │   Express Backend (app/)         │
               │   http://localhost:8080          │
               │                                 │
               │   POST /auth/signup             │
               │   POST /auth/login              │
               │   POST /auth/refresh            │
               │   POST /auth/logout             │
               │   GET  /reference/districts     │
               │   GET  /reference/colleges      │
               │   GET  /reference/degrees       │
               │   GET  /reference/courses       │
               │   GET  /health                  │
               └────────────────┬────────────────┘
                                │ pg (node-postgres)
               ┌────────────────▼────────────────┐
               │   PostgreSQL (Supabase)          │
               │                                 │
               │   users                         │
               │   sessions                      │
               │   refresh_tokens                │
               │   password_reset_tokens         │
               │   districts / colleges          │
               │   degrees / courses             │
               └─────────────────────────────────┘
```

**Security properties of the IPC layer:**

- `contextIsolation: true` — the renderer cannot access Node.js APIs directly.
- `nodeIntegration: false` — `require()` is not available in the renderer.
- `sandbox: false` — required for native addons (ONNX, SQLite) in the main process; the renderer itself remains sandboxed via context isolation.
- The `contextBridge` in `preload.js` is the only surface the renderer can call. Every exported function is an explicit allowlist — there is no generic IPC passthrough.

---

## Authentication architecture

```text
Signup / Login flow
───────────────────
Renderer → fetch POST /auth/signup|login
         → Express validates schema (Zod)
         → authService.signup|login()
              → bcrypt.compare / bcrypt.hash (rounds=12)
              → INSERT INTO sessions
              → INSERT INTO refresh_tokens
              → sign JWT access (15 min) + refresh (7 days)
         → 201/200 { accessToken, refreshToken, user }
Renderer ← response
         → tokenStore.saveTokens(access, refresh)
              → window.electronAPI.tokenSave(access, refresh)
                    → electron-store.set('accessToken', ...)
                    → electron-store.set('refreshToken', ...)
                       (AES-256 encrypted; stored in userData/)
         → localStorage.setItem('cortex-auth-profile', { id, email, ... })
           (profile only — NO password, NO token)

Token refresh flow
──────────────────
Renderer notices 401 → tokenStore.getRefreshToken()
         → fetch POST /auth/refresh { refreshToken }
         → Express validates token, issues new accessToken
         → tokenStore.saveTokens(newAccess, sameRefresh)

Logout flow
───────────
Renderer → fetch POST /auth/logout (Authorization: Bearer <accessToken>)
         → Express revokes refresh token in DB
         → tokenStore.clearTokens()
              → electron-store.delete('accessToken')
              → electron-store.delete('refreshToken')
         → window.electronAPI.logout()
              → deleteSession() — removes cortex-session.json
              → mainWindow.loadFile(landingPath)

Forgot-password OTP flow (IPC, not HTTP)
─────────────────────────────────────────
Renderer → window.electronAPI.authForgotPassword({ email })
         → ipcMain 'auth-forgot-password'
              → rate check (5 attempts / 15 min per email, in-process Map)
              → pg query: SELECT id FROM users WHERE email = ?
              → crypto.randomBytes → 8-char alphanumeric OTP
              → sha256(OTP) → stored in password_reset_tokens (15 min TTL)
              → nodemailer → sends OTP to user's email
         → always 200 (prevents email enumeration)

Renderer → window.electronAPI.authResetPassword({ token, new_password })
         → ipcMain 'auth-reset-password'
              → sha256(token) → lookup password_reset_tokens
              → bcrypt.hash(new_password, 12) → UPDATE users
              → DELETE password_reset_tokens WHERE user_id = ?
         → 200 on success, 400 on invalid/expired token
```

**Why forgot-password goes through IPC and not the Express backend:**

The forgot-password and reset-password flows need direct database access (to write/read `password_reset_tokens`) and SMTP credentials. Both of those are available in the Electron main process (which has access to the full `.env` and the Postgres pool). Routing them through the Express backend would require exposing an unauthenticated endpoint that could be probed externally. The IPC path keeps the OTP logic in a privileged process that is not reachable from outside the machine.

---

## Data flow summary

```text
User uploads a PDF
──────────────────
Renderer → electronAPI.uploadPdf()
         → IPC: 'upload-pdf'
         → dialog.showOpenDialog() → path
         → extractPdfText(path) → chunks[]
         → for each chunk:
              db.insertDocument(title, source, content, chunkIndex) → docId
              embeddingsEngine.embed(content) → float32 vector
              db.insertEmbedding(docId, vector)
         → { success: true, chunks: N }

User searches
─────────────
Renderer → electronAPI.search(query)
         → IPC: 'search'
         → embeddingsEngine.embed(query) → queryVector
         → db.getAllEmbeddings() → [{ docId, vector }]
         → cosineSimilarity(queryVector, each vector) → top-K docIds
         → db.getDocumentsByIds(top-K) → chunks
         → (optional) LLM synthesis → answer string
         → { results: [...] }

User adds a note
────────────────
Renderer → electronAPI.addNote({ title, content, type, dueDate })
         → IPC: 'add-note'
         → db.addNote(...) → id
         → { success: true, id }
```

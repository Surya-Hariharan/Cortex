# Cortex — Architecture & Design Decisions

This document explains the major architectural choices in Cortex, the trade-offs
considered, and why the current design was selected over alternatives.

Cortex is a **fully local-first** Electron desktop application. There is no backend
server, no cloud database, and no network dependency for the core experience —
everything runs in the Electron process on the user's device.

---

## Table of Contents

1. [Why local-first (no backend required)](#why-local-first-no-backend-required)
2. [Why Electron and not a web app](#why-electron-and-not-a-web-app)
3. [Why SQLite for local data](#why-sqlite-for-local-data)
4. [Offline-first design philosophy](#offline-first-design-philosophy)
5. [IPC architecture](#ipc-architecture)
6. [Authentication architecture](#authentication-architecture)
7. [Optional cloud backend](#optional-cloud-backend)
8. [Data flow summary](#data-flow-summary)
9. [Project structure](#project-structure)

---

## Why local-first (no backend required)

Cortex previously shipped with an Express/Postgres backend for authentication and
reference data. That backend was removed so the application could run entirely in the
Electron main process:

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

**Cross-device sync, backup, collaboration, and email-based account features are now
available, optionally, via Supabase and MailerLite.** An `apps/server` backend has been
reintroduced — physically separate from the desktop app, with its own `package.json`, and
structurally unable to become a hard dependency (the desktop app never blocks on it, probes
for it at startup, or falls back to it for core functionality). It uses Supabase for managed
Postgres + Auth (identity, sessions, password hashing) and MailerLite for every transactional
email (verification, password reset, login/device alerts, invitations, product
announcements). See [Optional cloud backend](#optional-cloud-backend) below and
[`apps/server/docs/ARCHITECTURE.md`](../apps/server/docs/ARCHITECTURE.md) for the full
design, including why this is safe for the local-first philosophy: the server only ever
sees encrypted note content, never plaintext, and neither Supabase nor MailerLite being
unreachable can prevent the desktop app from launching or working offline.

---

## Why Electron and not a web app

Cortex's core value proposition is offline-first, local AI. That requires:

1. **Filesystem access** — reading PDFs, writing the SQLite database, storing ONNX
   model weights. Browser web apps can only touch files opened via a picker.
2. **Native Node.js addons** — `onnxruntime-node`, `better-sqlite3`, and `bcrypt`
   are native C++ modules that do not run in a browser sandbox.
3. **LAN discovery without a server** — mDNS peer discovery uses UDP multicast,
   which browsers cannot send.
4. **Encrypted local storage** — a device-local AES key (`keyStore.js`) encrypts
   notes and documents at rest; `localStorage` alone is not encrypted.
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
| Password reset (local account) | Not available in local-first mode | — |
| Cloud account: sign-up/login, password reset, cross-device sync, backup, collaboration | — | Optional, via `apps/server` + Supabase + MailerLite (see below) |

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

The default, always-available auth path is entirely local — no JWTs, no Postgres, no
SMTP. This is unaffected by whether `apps/server` exists, is running, or is configured;
it is a structurally separate code path (see [Optional cloud backend](#optional-cloud-backend)).

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
Not supported for local accounts — there is no email/SMTP path on-device by
design. The 'auth-forgot-password' and 'auth-reset-password' IPC handlers return
an explicit { status: 400, detail: '... not available in local-first mode' }.
Email-based password reset IS available for cloud accounts — see below.
```

Because the local user database lives on-device and is never exposed over a network,
there is no external attack surface for local auth — the threat model is limited to
someone with physical/filesystem access to the machine.

---

## Optional cloud backend

`apps/server` is a separate Node/Express service (own `package.json`) backed by **Supabase**
(managed Postgres + Auth) that adds account-based auth, cross-device sync, encrypted backup,
and collaboration, and uses **MailerLite** for every transactional email — entirely opt-in,
and never on the path to launching the app or using it offline. Full design in
[`apps/server/docs/ARCHITECTURE.md`](../apps/server/docs/ARCHITECTURE.md); API reference in
[`apps/server/docs/API.md`](../apps/server/docs/API.md); schema + RLS policies in
[`apps/server/docs/DATABASE.md`](../apps/server/docs/DATABASE.md); threat model in
[`apps/server/docs/SECURITY.md`](../apps/server/docs/SECURITY.md); manual + automated test
report in [`apps/server/docs/TESTING.md`](../apps/server/docs/TESTING.md).

```text
┌────────────────────────────┐         ┌───────────────────────────────┐
│   Desktop app (Electron)    │  HTTPS  │        apps/server (opt-in)     │
│                             │◄───────►│                                 │
│  services/cloud/            │ (only if │  auth (Supabase), sync,        │
│    cloudClient.js           │CORTEX_   │  backup, collaboration,        │
│    deviceKeys.js            │CLOUD_API │  notifications                 │
│    contentKey.js            │_URL set) │                                 │
│    syncEngine.js            │         │  → Supabase (Postgres + Auth)   │
│  services/storage/          │         │  → MailerLite (email)           │
│    cloudTokenStore.js       │         │                                 │
│  renderer: Settings → Cloud │         │  never sees plaintext notes     │
│    & Sync tab               │         │                                 │
└────────────────────────────┘         └───────────────────────────────┘
```

Note the Electron app never talks to Supabase or MailerLite directly — it only ever calls
`apps/server`'s own HTTP API, so neither Supabase's nor MailerLite's SDKs/credentials ship in
the desktop binary at all.

Key separation properties:

- **Config-gated, not code-path-gated.** `cloudClient.js` checks
  `process.env.CORTEX_CLOUD_API_URL` on every call and throws a `notConfigured` error
  instead of making a request when it's unset — there's no scenario where the app
  silently blocks waiting on the server. `syncEngine.js`'s background loop
  (`main.js`'s `startCloudSyncLoop`) additionally requires an active cloud session and an
  established content key before it does anything.
- **Separate token storage.** Cloud session tokens live in `cortex-cloud-session.json`
  (via `cloudTokenStore.js`), encrypted with the same on-device key as local notes
  (`keyStore.js`), but in a file completely separate from the local offline session
  (`cortex-session.json` in `main.js`). Logging out of the cloud account cannot affect
  local login, and vice versa.
- **Separate IPC handlers.** Every cloud-facing action is its own `cloud-*` IPC handler in
  `main.js` (`cloud-auth-register/login/logout/logout-all`, `cloud-sync-now/status`,
  `cloud-backup-now/list/restore`, `cloud-friends-*`/`cloud-workspaces-*`/etc.), independent
  of `auth-register` / `auth-login`. Nothing in the existing local-auth flow
  (`AuthPortal.jsx`, the local `auth-*` handlers) calls into the cloud path. The renderer
  surface for all of this is a single "Cloud & Sync" tab in the Settings modal
  (`renderer/components/layout/Settings.jsx`) — connect/disconnect, device list, manual
  sync/backup, sign-out-everywhere, account deletion.
- **Zero-knowledge by construction.** Whatever syncs through this path is encrypted
  client-side first with a per-user content key (`contentKey.js`) that's distributed
  across a user's own devices by RSA-OAEP wrapping (`deviceKeys.js`), never given to the
  server in usable form; the server's job is auth, metadata, and coordination, not reading
  notes. See `apps/server/docs/SECURITY.md`.

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
│   ├── desktop/                 # The Electron application
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
│       │   │   ├── storage/     # database, encryption, keyStore, cloudTokenStore, pdfHandler
│       │   │   ├── network/     # peerDiscovery (mDNS)
│       │   │   ├── mesh/        # meshController
│       │   │   ├── offline/     # offline identity
│       │   │   ├── cloud/       # optional cloud client: cloudClient, cloudSession,
│       │   │   │                #   deviceKeys, contentKey, syncEngine
│       │   │   ├── system/      # device capability
│       │   │   └── api.js       # renderer-facing facade over IPC
│       │   └── __tests__/       # Vitest suites
│       └── package.json
│   └── server/                  # Optional cloud backend — see apps/server/docs/
│       ├── src/                 # routes → controllers → services → repositories → db/config
│       │   ├── config/          # env config + config/supabase.js (Supabase Auth clients)
│       │   ├── templates/       # MailerLite email templates (shared layout + per-email)
│       │   └── ...              # auth, users, sync, backup, collaboration, notifications
│       ├── tests/
│       ├── docs/                # ARCHITECTURE, API, DATABASE, SECURITY, TESTING
│       └── package.json
├── docs/                        # This document
├── .github/workflows/           # CI
└── README.md
```

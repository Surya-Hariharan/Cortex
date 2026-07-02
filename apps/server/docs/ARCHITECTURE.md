# Cortex Server — Architecture

## 1. Where this fits

Cortex is a local-first Electron app: every user's notes, documents, embeddings, vector
indexes, OCR results, AI conversations, tasks, diagrams, and whiteboards live in a local
SQLite database on their machine (`apps/desktop/src/services/storage/database.js`), encrypted
at rest with a device-local key (`apps/desktop/src/services/storage/keyStore.js`). None of
that changes. `apps/server` is a **separate, optional** service that the desktop app talks
to only when a user explicitly opts in to a cloud account. It is never on the path to
opening the app, searching notes, or running local AI.

```text
┌────────────────────────────────────────┐        ┌───────────────────────────────────┐
│         Cortex Desktop (Electron)       │        │          Cortex Server             │
│                                          │        │        (apps/server, optional)     │
│  Local SQLite: notes, docs, embeddings,  │        │                                     │
│  tasks, diagrams, whiteboards, OCR,      │  HTTPS │  Supabase Postgres: profiles,       │
│  AI conversations — source of truth      │◄──────►│  devices, sync metadata (ciphertext │
│                                          │ (opt-in)│  only), workspaces, invitations,    │
│  Local AI: BGE embeddings, Phi-3/Ollama  │        │  orgs, backups, notifications,      │
│                                          │        │  activity log                       │
│                                          │        │  + Supabase Auth (identity)          │
│                                          │        │  + MailerLite (transactional email)  │
└────────────────────────────────────────┘        └───────────────────────────────────┘
     always works offline                              never required to boot the app
```

Why a separate app instead of a folder inside `apps/desktop`: the server has its own
runtime (long-lived Node process, Postgres connection pool), its own deploy lifecycle, and
its own dependency graph (`express`, `pg`, `@supabase/supabase-js`) that has no business being
bundled into the Electron binary. Keeping it physically separate (own `package.json`) makes
"the desktop app doesn't depend on the backend" a structural fact, not a policy someone has
to remember — and it means the Electron app never links against Supabase's SDK at all: it
only ever talks to `apps/server` over plain HTTP, never to Supabase directly.

**Why Supabase, and why apps/server still exists on top of it:** Supabase provides the
managed Postgres database and the auth/session/password-hashing/token-rotation machinery
(`auth.users`, refresh tokens, email OTPs) so this project doesn't hand-roll any of that.
`apps/server` is not a thin proxy in front of it, though — it's the "Backend API" layer with
its own business logic (device/session bookkeeping, zero-knowledge sync, collaboration roles,
backup snapshots, audit logging, transactional email) that doesn't fit inside Supabase's
Auth/RLS model alone. It connects to Supabase's Postgres with a direct connection string
(via `pg`, unchanged from before Supabase was introduced) and to Supabase Auth via
`@supabase/supabase-js` using a service-role key — see [SECURITY.md](SECURITY.md) for why
that key never leaves this process.

## 2. What the server does and does not store

| Data | Where |
| --- | --- |
| Notes, documents, PDFs, knowledge graph, embeddings, vector indexes, OCR, AI conversations, local settings, tasks, diagrams, whiteboards | **Desktop only** (local SQLite) |
| Email, identity, password (hashed) | **Supabase Auth** (`auth.users`) — this server never sees or stores a password |
| Device list, profile, preferences, subscription status, activity log | **Server** (Supabase Postgres, `public` schema) |
| Sync payloads, backup snapshots | **Server**, but as ciphertext the server cannot decrypt — see [SECURITY.md](SECURITY.md) |
| Friend graph, workspace membership, invitations, organizations, notifications | **Server** (this is inherently server-side coordination state) |
| Transactional email delivery | **MailerLite** — the server renders the email, MailerLite sends it; MailerLite never sees anything except the address + rendered content of that one email |

## 3. Layering (`src/`)

```
routes → controllers → services → repositories → db/pool (pg) / config/supabase.js
                 │
                 ├─ models/        zod request schemas (validated by middleware/validate.js)
                 ├─ middleware/    authenticate, requireWorkspaceRole, rateLimit, errorHandler
                 └─ templates/     MailerLite email templates (shared layout + per-email content)
```

- **routes** wire URL + HTTP verb + middleware to a controller function. No logic.
- **controllers** parse `req`, call exactly one service method, shape the HTTP response.
- **services** hold business rules (conflict detection, invitation expiry, enumeration-safe
  password reset, best-effort email/audit-log dispatch). Services never touch `pg` directly,
  and only `auth.service.js`/`users.service.js` talk to Supabase Auth
  (`config/supabase.js`) — every other service is unaffected by the choice of identity
  provider.
- **repositories** are the only files that import `db/pool` — one file per aggregate. This
  is why swapping the identity provider (bcrypt+JWT → Supabase Auth) barely touched them:
  `sync.repository.js`, `collaboration.repository.js`, `notifications.repository.js`,
  `backup.repository.js` are all still plain `pg` queries against the same Postgres — only
  now it's Supabase's Postgres, and `users`/`devices` FK to `auth.users(id)` instead of a
  locally-defined `users` table.
- This mirrors the desktop app's own separation of `main.js` (thin IPC handlers) from
  `services/storage/database.js` (the only file that touches `better-sqlite3`).

## 4. Authentication flow

Identity, password hashing, session issuance, and refresh-token rotation are all delegated
to **Supabase Auth** — this server verifies Supabase-issued access tokens
(`utils/supabaseToken.js`) and never signs one itself. See [SECURITY.md](SECURITY.md) for
the verification details.

```mermaid
sequenceDiagram
    participant D as Desktop app (main process)
    participant S as Cortex Server
    participant SB as Supabase Auth
    participant DB as Supabase Postgres

    D->>S: POST /auth/login {email, password, device}
    S->>SB: auth.signInWithPassword({email, password})
    SB-->>S: session {access_token, refresh_token, user}
    S->>DB: UPSERT devices (fingerprint, public_key)
    S->>DB: INSERT activity_logs (login)
    S-->>D: { user, device, accessToken, refreshToken }
    D->>D: cloudTokenStore.save() — AES-encrypted with the device key, separate from local session
    Note over S: best-effort MailerLite login-notification + new-device-alert email

    Note over D,S: later, accessToken expires
    D->>S: POST /auth/refresh { refreshToken, deviceId? }
    S->>SB: auth.refreshSession({refresh_token})
    SB-->>S: new session (Supabase rotates the refresh token internally)
    S-->>D: { accessToken, refreshToken }

    Note over D,S: sign out (this device only)
    D->>S: POST /auth/logout  (Authorization: Bearer <accessToken>)
    S->>SB: auth.admin.signOut(accessToken, 'local')

    Note over D,S: "sign out of all devices"
    D->>S: POST /auth/logout-all
    S->>SB: auth.admin.signOut(accessToken, 'global')
    S->>DB: UPDATE devices SET revoked_at = now() WHERE user_id = ?
```

Email verification and password reset both go through Supabase's `admin.generateLink`,
which returns a one-time code (`email_otp`) — the server emails that code itself via
MailerLite rather than relying on Supabase's own SMTP, so every outbound email in this
project (verification, reset, login notification, new-device alert, account deletion
confirmation, workspace invites, product announcements) has one delivery path
(`services/email.service.js`) and one provider (MailerLite).

## 5. Sync flow (zero-knowledge)

The server cannot read note content — it stores ciphertext + a version counter per
`(user, resourceType, resourceId)` and resolves conflicts by version comparison only, never
by content. This part is unchanged by the Supabase migration. See
[SECURITY.md](SECURITY.md) for the encryption model this assumes on the client
(`apps/desktop/src/services/cloud/contentKey.js`, `deviceKeys.js`, `syncEngine.js`).

```mermaid
sequenceDiagram
    participant D as Desktop app
    participant S as Cortex Server
    participant DB as Supabase Postgres

    Note over D: user edits a note locally (always works, offline)
    D->>D: contentKey.encryptResource(note) → ciphertext, nonce (AES-256-GCM, per-user content key)

    D->>S: POST /sync/push { deviceId, blobs: [{resourceId, ciphertext, nonce, baseVersion}] }
    S->>DB: SELECT sync_blobs WHERE (user, resourceType, resourceId) FOR UPDATE
    alt baseVersion matches current server_version
        S->>DB: archive old row into sync_blob_versions, UPDATE with new ciphertext, version+1
        S->>DB: UPSERT sync_metadata (per-device cursor bookkeeping)
        S-->>D: 207 { accepted: [...] }
    else baseVersion stale (concurrent edit from another device)
        S-->>D: 207 { conflicts: [{resourceId, server: {ciphertext, version}}] }
        Note over D: left dirty locally and reported via syncEngine.getLastResult() —<br/>never silently overwritten. Automatic merge UI is a follow-up.
    end

    Note over D: another device pulls
    D->>S: GET /sync/pull?since=<cursor>&deviceId=...
    S->>DB: SELECT sync_blobs WHERE updated_at > cursor
    S-->>D: { blobs: [...], cursor: <new watermark>, hasMore }
    D->>D: contentKey.decryptResource() each blob, merge into local SQLite
```

**Cross-device content key distribution:** the AES key that encrypts sync payloads is a
per-*user* symmetric key (`contentKey.js`), not a per-device or server-held key. The first
device a user enables cloud sync on generates it and uploads a copy wrapped (RSA-OAEP) to
that device's own public key (`PUT /auth/devices/:deviceId/key`, `devices.wrapped_user_key`
— opaque to the server). A second device adopts it the same way workspace collaboration
already does: unwrap a per-device wrapped copy with its own private key
(`deviceKeys.js`). The handshake for "an already-enrolled device notices a *new* device and
wraps a copy for it" isn't built yet — see `syncEngine.js`'s `ensureDeviceEnrolled` docblock.

## 6. Collaboration flow (workspace sharing)

A workspace's content key is generated and wrapped **client-side** — the server stores the
wrapped key as an opaque blob per member and never sees the unwrapped key. Unchanged by the
Supabase migration other than the underlying table name (`notebook_permissions`, was
`workspace_members`; `collaboration_invites`, was `workspace_invitations`).

```mermaid
sequenceDiagram
    participant A as Owner's desktop app
    participant S as Cortex Server
    participant DB as Supabase Postgres
    participant B as Invitee's desktop app

    A->>S: POST /workspaces/:id/invitations { inviteeEmail, role }
    S->>DB: INSERT collaboration_invites (token_hash, expires_at)
    S->>S: email.service sends the invite via MailerLite (raw token only ever emailed)
    S-->>A: { id, inviteeEmail, role, status: pending }

    B->>S: POST /invitations/:token/accept { wrappedContentKey }
    Note over B: wrappedContentKey = workspace content key,<br/>encrypted client-side to B's device public key
    S->>DB: validate token (pending, not expired)
    S->>DB: INSERT notebook_permissions (role, wrapped_content_key = opaque blob)
    S-->>B: { workspaceId, role }

    Note over B: B can now sync workspace content —<br/>only B's device can unwrap the content key
```

## 7. Backup flow

A backup is a cheap, named restore point — a pointer at the user's sync cursor — not a
second copy of ciphertext. Restoring replays `sync_blob_versions` at-or-before that cursor.

```mermaid
sequenceDiagram
    participant D as Desktop app
    participant S as Cortex Server
    participant DB as Supabase Postgres

    D->>S: POST /backups { deviceId, kind: manual|automatic }
    S->>DB: SELECT count/bytes/max(updated_at) FROM sync_blobs WHERE user_id = ?
    S->>DB: INSERT backup_metadata (sync_cursor, resource_count, total_bytes)
    S-->>D: backup row

    D->>S: POST /backups/:id/restore
    S->>DB: SELECT sync_blobs WHERE user_id = ? AND updated_at <= backup.sync_cursor
    S->>DB: UPDATE backup_metadata SET status = 'restored'
    S-->>D: { backup, blobs: [...] }
    D->>D: decrypt + overwrite local rows for each resource
```

Automatic backups run once per day from the same background interval that drives sync
(`apps/desktop/src/main/main.js`'s `startCloudSyncLoop`), only while online and only while
cloud sync is enabled.

## 8. Running two processes locally

```bash
# Terminal 1 — desktop app (works with zero setup)
cd apps/desktop && npm start

# Terminal 2 — optional server, only needed to exercise cloud features.
# Requires a Supabase project (see .env.example for SUPABASE_URL / keys) and
# MAILERLITE_API_KEY if EMAIL_PROVIDER=mailerlite; otherwise emails log to stdout.
cd apps/server && npm run migrate && npm run dev
```

The desktop app does not probe for or wait on the server at startup — see
`apps/desktop/src/main/main.js`, where the only network probes are the public-internet
connectivity checks (`checkInternetConnectivity`), not a call to this server.

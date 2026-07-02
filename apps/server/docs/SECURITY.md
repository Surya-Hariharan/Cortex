# Cortex Server — Security Model

## Design goal

The server coordinates accounts, sync metadata, and collaboration — it is explicitly **not**
trusted with plaintext user content. If the server's database leaked in full, an attacker
would get: email addresses, Supabase's password hashes, device names/fingerprints/public
keys, and encrypted blobs they cannot open. They would not get a single note, document, or
AI conversation.

## Identity: delegated to Supabase Auth

This server does not hash passwords, issue JWTs, or manage refresh-token rotation itself —
all of that is Supabase Auth (`auth.users`, its own session/refresh-token tables). What this
server does:

- **Verifies** Supabase-issued access tokens (`src/utils/supabaseToken.js`): HS256 against
  `SUPABASE_JWT_SECRET`, checks `aud === 'authenticated'`, maps the `sub` claim to `req.user.id`.
  It never signs a token.
- **Calls Supabase Auth's Admin API** (`src/config/supabase.js#supabaseAdmin`, service-role
  key) for admin actions: creating a user on registration, generating verification/recovery
  links (delivered via MailerLite, not Supabase's own SMTP — see below), signing out sessions
  (single-device or global), updating a password, deleting an account.
- **Calls the anon-key client** (`supabaseAnon`) for the operations Supabase's own credential
  checks gate: `signInWithPassword`, `refreshSession`, `verifyOtp`.

Because identity moved to Supabase, `apps/server` no longer stores a password, a refresh
token, or an email-verification/password-reset token anywhere — see
[DATABASE.md](DATABASE.md) for what was removed.

## Zero-knowledge sync, backup, and collaboration

- **Encryption happens client-side, before `POST /sync/push`.** The server's `sync_blobs`
  table stores `ciphertext`/`nonce` as opaque `bytea` (`src/repositories/sync.repository.js`)
  — no route, service, or query ever branches on decrypted content. The AES-256-GCM key doing
  this encryption is a per-user symmetric key that never reaches the server in usable form —
  see `apps/desktop/src/services/cloud/contentKey.js`.
- **The content key is distributed cross-device by RSA-OAEP wrapping, not by giving the
  server a copy.** Each device generates its own keypair
  (`apps/desktop/src/services/cloud/deviceKeys.js`, private key persisted encrypted at rest
  with the *local* device master key — `keyStore.js`), uploads only the public half
  (`devices.public_key`), and the server stores/returns only RSA-wrapped copies of the
  content key (`devices.wrapped_user_key`) — it can never unwrap them.
- **Workspace content keys are wrapped client-side** the same way.
  `notebook_permissions.wrapped_content_key` holds the workspace's symmetric key, encrypted
  to each member's device key before it's ever sent to the server (see the sharing sequence
  diagram in [ARCHITECTURE.md](ARCHITECTURE.md#6-collaboration-flow-workspace-sharing)). The
  server stores it but cannot unwrap it.
- **Backups don't duplicate ciphertext.** A backup (`backup_metadata`) is a pointer at a sync
  cursor, not a second encrypted copy — restore replays the same `sync_blob_versions` history
  that already exists for ongoing sync.
- **Conflict resolution without reading content.** `sync.repository.js#upsertBlob` uses
  optimistic concurrency: the client sends `baseVersion` (the `server_version` it last saw). A
  mismatch means another device wrote first — the server returns conflict info
  (`{ conflicts: [...] }` in the 207 response) with the current ciphertext so the client can
  decrypt both sides and merge. The server never attempts a merge itself, and the desktop
  client (`syncEngine.js`) never silently overwrites a conflicting local change — it's left
  dirty and surfaced via `getLastResult()` rather than auto-resolved. Building a
  conflict-resolution UI on top of that is a follow-up.

## Passwords and sessions

- **Hashing**: Supabase Auth's own (bcrypt-family) — this server never sees a plaintext or
  hashed password.
- **Password reset** (`POST /auth/password/forgot`) always returns the same response whether
  or not the email is registered, preventing account enumeration
  (`auth.service.js#requestPasswordReset`).
- **A successful password reset revokes every existing session** — the recovery OTP flow
  (`supabaseAnon.auth.verifyOtp`) returns a session whose access token is used to call
  `admin.signOut(token, 'global')`, and every local `devices` row is marked revoked
  (`auth.service.js#resetPassword`). If the reset was triggered because credentials leaked,
  this closes any session an attacker already opened.
- **Access tokens**: Supabase-issued JWTs, short-lived (Supabase default ~1h), verified but
  never persisted server-side.
- **Refresh-token rotation** and **replay handling**: both delegated to Supabase Auth
  internally — this server no longer implements the rotation-chain/replay-detection logic
  itself (previously a recursive-CTE revocation chain in a locally-owned table).

## MailerLite (transactional email)

- **Single delivery path**: every email in this codebase — verification, password reset,
  login notification, new-device alert, account-deletion confirmation, workspace/project
  invitations, share notifications, team updates, release announcements, security notices,
  newsletter opt-in — goes through `src/services/email.service.js`, which renders a template
  (`src/templates/`) and hands it to whichever provider `EMAIL_PROVIDER` selects
  (`mailerlite` in production, `console` in dev/test).
- **Best-effort, never blocking**: `src/services/providers/mailerlite.provider.js` retries a
  failed send up to 3 times with backoff, then logs and returns — it never throws. A
  MailerLite outage cannot fail registration, login, or any other primary action.
- **Product emails require opt-in**: release announcements, security notices, and newsletters
  are only ever sent to users whose `user_profiles.preferences` records consent — this is a
  caller-side contract (`email.service.js`'s product-email functions don't themselves check a
  recipient list), enforced at the call site.

## Row Level Security

Every table in `public` has RLS enabled with a policy scoped to `auth.uid()` or workspace
membership — see [DATABASE.md](DATABASE.md#row-level-security). `apps/server` connects with
the Postgres/service role and therefore bypasses RLS by design: this server does its own
authorization in the middleware/repository layer (`requireWorkspaceRole`, `WHERE user_id = $1`
clauses everywhere), same as before Supabase. RLS is defense-in-depth for the
`anon`/`authenticated` Postgres roles Supabase's PostgREST/Realtime/client SDKs would use —
relevant if this project ever adds direct-from-client Supabase access, which it does not
today (the Electron app only ever talks to `apps/server`, never to Supabase directly).

## Transport and request hardening

- `helmet()` default headers, `express-rate-limit` (20 req/15 min on `/auth/*` writes, 300
  req/15 min globally), `express.json({ limit: '2mb' })` to bound request bodies.
- CORS defaults to **deny all** (`CORS_ORIGINS` unset → `cors({ origin: false })`) — this API
  is consumed by the Electron main process over a direct HTTPS request, not by a browser page,
  so there's no legitimate cross-origin caller by default.
- Every request body/query is validated against a `zod` schema before it reaches a controller
  (`src/middleware/validate.js`) — unexpected fields are stripped, wrong types are rejected
  with 400 before touching the database.
- The global error handler (`src/middleware/errorHandler.js`) never leaks stack traces or
  internal error messages in production (`NODE_ENV=production` collapses 5xx bodies to a
  generic message).

## Audit logging

`activity_logs` (best-effort, `src/services/activityLog.service.js`) records security-relevant
events: account created/deleted, login, device revoked, signed-out-all-devices, email
verified, password reset, sync push/pull, backup created/restored. A logging failure is
caught and warned, never allowed to fail the action being logged. Note: because
`activity_logs` FKs to `auth.users(id) ON DELETE CASCADE`, an account-deletion log entry is
itself deleted moments after being written — an accepted simplification for this scope rather
than standing up a separate non-cascading audit archive.

## What never ships in the desktop app

- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, the Postgres connection string,
  `MAILERLITE_API_KEY`, and any other server-side secret exist only in `apps/server`'s
  environment. The desktop app only ever holds *user-scoped* bearer/refresh tokens obtained
  after a real login, plus its own device keypair and content key — see
  `apps/desktop/src/services/storage/keyStore.js` for the local AES key those are encrypted
  with at rest, and `apps/desktop/src/services/storage/cloudTokenStore.js` for where the
  session itself is stored, kept entirely separate from the local (offline) session file so a
  cloud logout can never affect local auth.

## Threat model boundaries (explicitly out of scope for this phase)

- End-to-end verification that a workspace member's (or a second personal device's) public
  key genuinely belongs to the claimed user (key-pinning / out-of-band verification, à la
  Signal safety numbers) — invitation and device-enrollment flows trust email/account access
  for now.
- The "already-enrolled device wraps a copy of the content key for a brand-new device"
  handshake — today only the *first* device per account bootstraps the content key; see
  `syncEngine.js#ensureDeviceEnrolled`.
- Full point-in-time restore across every resource — `POST /backups/:id/restore` returns
  resources unchanged since the backup's cursor, not a time-travelled reconstruction of
  resources edited since (see `sync.repository.js#listAsOf`).
- Real push notification delivery (FCM/APNs) — `push.service.js` ships a `noop` provider
  behind the same interface so wiring a real one later doesn't touch calling code.
- Billing/subscription enforcement — `user_profiles.subscription_plan` exists but nothing
  currently gates behavior on it.

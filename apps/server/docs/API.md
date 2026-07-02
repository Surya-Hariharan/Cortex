# Cortex Server — API Reference

Base URL: `/api/v1`. All request/response bodies are JSON. Authenticated routes require
`Authorization: Bearer <accessToken>` — this token is issued and rotated by **Supabase
Auth**, this server only verifies it (see [SECURITY.md](SECURITY.md)).

Error shape (all non-2xx responses): `{ "error": "<code>", "detail": "<human message>" }`.

## Auth — `/auth`

| Method | Path | Auth | Body | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | – | `{ email, password, full_name, device: { fingerprint, name, platform?, publicKey? } }` | 201, returns `{ user, device, accessToken, refreshToken }`. Also triggers a verification email + welcome email (MailerLite). |
| POST | `/auth/login` | – | `{ email, password, device }` | 200, same shape as register. Triggers a login-notification email, and a new-device-alert email if this device's fingerprint has never been seen. |
| POST | `/auth/refresh` | – | `{ refreshToken, deviceId? }` | 200, rotates the token (delegated to Supabase Auth): returns a **new** `{ accessToken, refreshToken }`. `deviceId` is optional and only used to keep `devices.last_seen_at` fresh. |
| POST | `/auth/logout` | Bearer | – | 200 `{ success: true }`. Signs out the session tied to *this* access token only (`Supabase auth.admin.signOut(token, 'local')`). |
| POST | `/auth/logout-all` | Bearer | – | 200. Signs out **every** session for this user (`'global'` scope) and marks every device row revoked. |
| POST | `/auth/verify-email/request` | Bearer | – | 200. Emails a fresh OTP via MailerLite. |
| POST | `/auth/verify-email/confirm` | Bearer | `{ token }` | 200. Verifies against the authenticated user's email. |
| POST | `/auth/password/forgot` | – | `{ email }` | 200 always, regardless of whether the email exists (enumeration-safe). |
| POST | `/auth/password/reset` | – | `{ email, token, new_password }` | 200. Revokes all existing sessions/devices for that user. |
| GET | `/auth/devices` | Bearer | – | `{ devices: [...] }` |
| DELETE | `/auth/devices/:deviceId` | Bearer | – | Revokes the device. |
| PUT | `/auth/devices/:deviceId/key` | Bearer | `{ wrappedUserKey }` | Uploads this device's RSA-OAEP-wrapped copy of the user's sync content key (opaque to the server) — see `apps/desktop/src/services/cloud/contentKey.js`. |
| DELETE | `/auth/account` | Bearer | – | Permanently deletes the Supabase Auth user; cascades to every table below via FK. Sends an account-deletion-confirmation email first. |

All `/auth/*` write routes are rate-limited (20 requests / 15 min / IP).

## Users — `/users`

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| GET | `/users/me` | – | Identity (from Supabase Auth) + profile, merged. |
| PATCH | `/users/me` | `{ full_name?, avatar_url?, display_name? }` | `full_name` updates Supabase `user_metadata`; the rest update the local `user_profiles` row. |
| GET | `/users/me/preferences` | – | `{ preferences: {...} }` (opaque JSON, client-defined shape — includes things like newsletter opt-in). |
| PUT | `/users/me/preferences` | `{ preferences: {...} }` | Full replace. |
| GET | `/users/me/subscription` | – | `{ plan, status, renewsAt }`. `plan: "free"` until billing is wired up. |

All routes require Bearer auth.

## Sync — `/sync`

| Method | Path | Body / Query | Notes |
| --- | --- | --- | --- |
| POST | `/sync/push` | `{ deviceId, blobs: [{ resourceType, resourceId, ciphertext (base64), nonce (base64), baseVersion, deleted? }] }` | 207 Multi-Status: `{ accepted: [...], conflicts: [...] }`. Each blob in the batch is resolved independently — one conflict doesn't fail the batch. `baseVersion: 0` means "I believe this doesn't exist on the server yet." |
| GET | `/sync/pull` | `?since=<ISO timestamp>&limit=<n>&deviceId=<uuid>` | `{ blobs: [...], cursor, hasMore }`. Omit `since` to pull everything. `deviceId` is optional, used to record `sync_metadata`. |
| GET | `/sync/resource/:type/:id/versions` | – | `{ versions: [{ version, ciphertext, nonce, createdAt }] }`, newest first. |
| GET | `/sync/status` | – | `{ metadata: [...] }` — this user's `sync_metadata` rows (per device, per resource type). |

The server never inspects `ciphertext`/`nonce` beyond storing/returning them as bytes — see
[SECURITY.md](SECURITY.md).

## Backups — `/backups`

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/backups` | `{ deviceId?, kind?: "manual"\|"automatic", label? }` | Creates a metadata-only restore point at the current sync cursor. |
| GET | `/backups` | – | `{ backups: [...] }`, newest first. |
| POST | `/backups/:backupId/restore` | – | `{ backup, blobs: [...] }` — every resource unchanged since the backup's cursor, for the client to decrypt and write back locally. |

All routes require Bearer auth.

## Collaboration

### Friends

| Method | Path | Body |
| --- | --- | --- |
| POST | `/friends/requests` | `{ addresseeEmail }` |
| GET | `/friends/requests` | – (pending requests addressed to you) |
| POST | `/friends/requests/:id/respond` | `{ accept: boolean }` |
| GET | `/friends` | – |

### Workspaces

| Method | Path | Body | Min role |
| --- | --- | --- | --- |
| POST | `/workspaces` | `{ name, kind: "notebook"\|"project", organizationId? }` | – (creator becomes owner) |
| GET | `/workspaces` | – | member |
| GET | `/workspaces/:id` | – | viewer |
| PATCH | `/workspaces/:id` | `{ name? }` | owner |
| DELETE | `/workspaces/:id` | – | owner |
| GET | `/workspaces/:id/members` | – | viewer |
| PATCH | `/workspaces/:id/members/:userId` | `{ role }` | owner |
| DELETE | `/workspaces/:id/members/:userId` | – | owner |
| POST | `/workspaces/:id/invitations` | `{ inviteeEmail, role: "editor"\|"viewer" }` | editor |
| GET | `/workspaces/:id/invitations` | – | editor |

Backed by the `notebook_permissions` / `collaboration_invites` tables — see
[DATABASE.md](DATABASE.md). The URL vocabulary (`/workspaces/...`) is unchanged.

### Invitations (by token, not workspace membership — the invitee isn't a member yet)

| Method | Path | Body |
| --- | --- | --- |
| POST | `/invitations/:token/accept` | `{ wrappedContentKey? }` — the workspace content key, wrapped client-side to the accepting device |
| POST | `/invitations/:token/decline` | – |

### Organizations

| Method | Path | Body |
| --- | --- | --- |
| POST | `/organizations` | `{ name }` |
| POST | `/organizations/:id/members` | `{ userId, role: "admin"\|"member" }` |
| DELETE | `/organizations/:id/members/:userId` | – |

## Notifications — `/notifications`

| Method | Path | Query / Body |
| --- | --- | --- |
| GET | `/notifications` | `?unread=true` to filter |
| PATCH | `/notifications/:id/read` | – |
| PATCH | `/notifications/read-all` | – |
| POST | `/notifications/push-tokens` | `{ deviceId, platform: "windows"\|"macos"\|"linux", token }` |
| DELETE | `/notifications/push-tokens/:id` | – |

## System

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | No auth, no database access — used for container/process healthchecks. |

# Cortex Server — Testing

## Automated coverage

Unit tests mock the Supabase client and repository layer (see the `require()`-not-`import()`
+ namespace-object convention documented at the top of `tests/unit/auth.service.test.js` —
services reach their dependencies via a plain object reference specifically so
`vi.spyOn(mod, 'fn')` takes effect), so the full suite runs with **no live Postgres,
Supabase project, or MailerLite account**:

```bash
cd apps/server && npm install && npm test
```

As of this integration: **7 files, 41 tests, all passing** —
`auth.service`, `users.service`, `sync.service`, `backup.service`, `collaboration.service`,
`mailerlite.provider`, and the `GET /health` / 404 / auth-gating integration test.

```bash
cd apps/desktop && npm test
```

**24 files, 348 tests, all passing**, including the local-first invariants in
`AuthPortal.test.jsx`/`api.test.js` (unaffected by this integration) and new coverage for
`deviceKeys.js`, `contentKey.js` (real crypto round-trips, no mocking — these use Node's
built-in `crypto` directly), `cloudClient.js` (mocked `fetch`), `syncEngine.js` (mocked
`cloudClient`/`contentKey`/a fake local-DB object), and the new dirty-tracking/tombstone/
sync-bookkeeping methods on `DatabaseWrapper`.

## What automated tests do **not** cover

Nothing here talks to a real Supabase project or sends a real MailerLite email — that
requires actual credentials this environment doesn't have. Below is what to run by hand once
you have a Supabase project (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_JWT_SECRET` — all in `apps/server/.env.example`) and a MailerLite account
(`MAILERLITE_API_KEY`, `EMAIL_PROVIDER=mailerlite`).

## Manual verification checklist

Setup:

```bash
cd apps/server
cp .env.example .env   # fill in Supabase + MailerLite values
npm install
npm run migrate         # applies src/db/migrations/*.sql to your Supabase Postgres
npm start
```

Then, from the desktop app (or `curl`/Postman against `http://localhost:4000/api/v1`) with
`CORTEX_CLOUD_API_URL=http://localhost:4000` set for the desktop app:

1. **Register** — `POST /auth/register`. Confirm: a user appears in Supabase's Auth
   dashboard; a verification email arrives via MailerLite; a welcome email arrives; a
   `devices` row and `user_profiles` row exist; the response includes a valid session.
2. **Verify email** — use the OTP from the verification email against
   `POST /auth/verify-email/confirm`. Confirm `email_confirmed_at` is set in Supabase.
3. **Login** — `POST /auth/login` with a *new* device fingerprint. Confirm both a
   login-notification email and a new-device-alert email arrive; logging in again with the
   *same* fingerprint should only send the login notification.
4. **Device management** — `GET /auth/devices` lists both devices; `DELETE
   /auth/devices/:id` revokes one; confirm a revoked device's future requests still work
   (revocation doesn't invalidate already-issued Supabase tokens in this pass — see
   SECURITY.md if tightening that matters for your deployment) but no longer appears active.
5. **Sign out of all devices** — `POST /auth/logout-all`, then confirm a previously-valid
   refresh token from another device's session now fails to refresh.
6. **Password reset** — `POST /auth/password/forgot`, use the emailed OTP against
   `POST /auth/password/reset`. Confirm the old password no longer logs in and all sessions
   were revoked.
7. **Sync push/pull** — from the desktop app's Cloud & Sync settings tab, connect a cloud
   account, create/edit a note or workspace page, click "Sync now." Confirm `sync_blobs`
   contains ciphertext (not plaintext — verify by reading the row directly in Supabase's SQL
   editor). On a second device/profile signed into the same account, confirm the note/page
   appears after a sync.
8. **Conflict handling** — edit the same note on two devices while one is offline, bring both
   online and sync both. Confirm one push reports a conflict (not a silent overwrite) and the
   conflicting local edit is preserved (still marked dirty) rather than lost.
9. **Backup + restore** — "Back up now," make further edits, then restore that backup.
   Confirm restored content matches the pre-edit state for resources not touched since, and
   that resources edited *after* the backup are left alone (see SECURITY.md's noted
   limitation on point-in-time restore).
10. **Collaboration** — create a workspace, invite another account's email, confirm the
    invitation email arrives via MailerLite, accept it from the invitee's session, confirm
    `GET /workspaces` shows it for both accounts with the right roles.
11. **Delete account** — `DELETE /auth/account`. Confirm: an account-deletion confirmation
    email arrives *before* deletion completes; the Supabase Auth user is gone; every FK'd row
    (`user_profiles`, `devices`, `sync_blobs`, workspace memberships, ...) is gone via
    cascade; local notes/documents on the desktop app are completely unaffected.
12. **RLS spot-check** — using the Supabase SQL editor's "Run as" role switcher (or the
    `anon`/`authenticated` Postgres roles directly), confirm a user cannot `SELECT` another
    user's `sync_blobs`/`devices`/`notebook_permissions` rows even though `apps/server`
    itself (service role) can.

## Offline-first confirmation (deliverable #10)

No credentials needed for this one — it's the point of the architecture:

1. Ensure `.env` has **no** `CORTEX_CLOUD_API_URL`, `SUPABASE_*`, or `MAILERLITE_*` values set
   (or don't run `apps/server` at all).
2. Launch the desktop app: `cd apps/desktop && npm start`.
3. Confirm: local sign-up/login works (bcrypt + local SQLite, `auth-register`/`auth-login`
   IPC handlers), notes and workspace pages can be created/edited/deleted, search and the
   local RAG pipeline work, and the "Cloud & Sync" settings tab shows the
   "Cloud sync isn't configured" state without erroring.
4. Run `cd apps/desktop && npm test` — the full suite, including
   `AuthPortal.test.jsx`/`api.test.js`'s explicit "local-first" assertions, passes with zero
   network calls.

Every cloud IPC handler in `apps/desktop/src/main/main.js` is gated by
`cloudClient.isConfigured()` and wrapped in try/catch; the background sync/backup interval
(`startCloudSyncLoop`) only ever calls `syncEngine.runSync()`, which itself no-ops
(`{ skipped: true, reason: 'not_enabled' }`) unless configured + a session + an established
content key all exist. There is no code path where an absent or unreachable Supabase/
MailerLite configuration can prevent the app from launching or using any local-first feature.

# Cortex Server

Optional cloud backend for [Cortex](../../README.md), backed by **Supabase** (managed
Postgres + Auth) and **MailerLite** (transactional email). Provides authentication, sync
metadata, backup, and collaboration — **never** notes, documents, or any user content, which
stay in the desktop app's local SQLite database.

The desktop app works fully offline without this service. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how the two are wired together, and the
root [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md#optional-cloud-backend) for the
project-wide picture.

## Setup

```bash
cd apps/server
cp .env.example .env   # set DATABASE_URL, SUPABASE_*, and (optionally) MAILERLITE_API_KEY
npm install
npm run migrate         # applies src/db/migrations/*.sql to your Supabase Postgres
npm start                # or `npm run dev` for auto-restart
```

Requires a [Supabase](https://supabase.com) project — `DATABASE_URL` is its Postgres
connection string; `SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`/
`SUPABASE_JWT_SECRET` are all in the project's API settings. Without `MAILERLITE_API_KEY`
set (`EMAIL_PROVIDER=console`, the default), emails just log to stdout instead of sending —
useful for local development without a MailerLite account. `GET /health` does not touch the
database, so the process comes up even before migrations are run — useful for container
healthchecks.

## Testing

```bash
npm test
```

Unit tests mock the Supabase client and repository layer, so they run without a live
Postgres, Supabase project, or MailerLite account. The one integration test boots the
Express app in-process (via `supertest`) and checks `/health` and auth-gating — it also
doesn't need a database. See [`docs/TESTING.md`](docs/TESTING.md) for the full test report
and a manual verification checklist for the credential-dependent flows.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — client-server architecture + sequence diagrams
- [`docs/API.md`](docs/API.md) — full REST API reference
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema reference + RLS policies
- [`docs/SECURITY.md`](docs/SECURITY.md) — zero-knowledge design, Supabase Auth, MailerLite, threat model
- [`docs/TESTING.md`](docs/TESTING.md) — automated coverage + manual verification checklist

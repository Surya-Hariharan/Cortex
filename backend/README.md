# Cortex Production Backend

Node.js + Express + PostgreSQL backend for Cortex login/signup, academic identity, session management, devices, and reference dropdown APIs.

## Setup

1. Copy `.env.example` to `.env` and configure values.
2. Install dependencies:
   npm install
3. Run migration:
   npm run migrate
4. Seed reference data:
   npm run seed
5. Start server:
   npm run dev

## Endpoints

- POST /auth/signup
- POST /auth/login
- POST /auth/refresh
- POST /auth/logout
- GET /reference/districts
- GET /reference/colleges?districtId=1
- GET /reference/degrees
- GET /reference/courses?degreeId=1
- POST /device/register

## Notes

- Refresh tokens are hashed before storage in `sessions.refresh_token`.
- Access token TTL and refresh token TTL are configurable via environment variables.
- Password hashes are never returned by APIs.

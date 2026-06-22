# ai_future — Archived Python AI Microservice

This directory contains the Python FastAPI backend and AI model code that was
removed from the active build during the v1 redesign baseline.

## What's here

| Path | Description |
|------|-------------|
| `main.py` | FastAPI application entry point (health-check only, redesign_baseline mode) |
| `core/` | Pydantic settings, logging, observability, rate limiter utilities |
| `ai_models/` | BGE embeddings, LLM inference, Whisper transcription, model manager |

## Why archived

The Python AI layer is being redesigned as a separate microservice. The Node.js
Electron backend (app/src/) now handles all active API routes. These files are
preserved here for reference during the microservice redesign.

## Reactivation

When the AI microservice work resumes:
1. Move these files back to `app/` (or a dedicated `services/ai/` package).
2. Wire up the new service endpoints in `frontend/src/services/api.js`.
3. Remove this directory once the microservice has its own repository.

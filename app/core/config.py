"""
Cortex — Core Configuration
Centralised settings via pydantic-settings. Values can be overridden with
environment variables or a .env file at the project root.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT_DIR = Path(__file__).resolve().parents[2]   # Cortex/
APP_DIR  = ROOT_DIR / "app"
DATA_DIR = ROOT_DIR / "data"
MODELS_DIR = ROOT_DIR / "models"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "Cortex"
    APP_VERSION: str = "1.0.0"
    TEAM: str = "SynapseX"
    ENV: Literal["local", "cloud"] = "local"
    DEBUG: bool = False

    # ── Server ───────────────────────────────────────────────────────────────
    HOST: str = "127.0.0.1"
    PORT: int = 8765
    RELOAD: bool = False

    # ── Database ─────────────────────────────────────────────────────────────
    SQLITE_URL: str = f"sqlite+aiosqlite:///{DATA_DIR / 'database' / 'cortex.db'}"
    # Cloud override: set in .env to use Supabase/Postgres instead of SQLite
    DATABASE_URL: str = ""

    # ── Vector Store ─────────────────────────────────────────────────────────
    VECTOR_STORE_PATH: Path = DATA_DIR / "vector_store"
    VECTOR_DIM: int = 384          # BGE-small embedding dim
    FAISS_INDEX_TYPE: str = "IVFFlat"   # or "Flat" for small datasets

    # ── AI Models ────────────────────────────────────────────────────────────
    BGE_MODEL_DIR: Path = MODELS_DIR / "bge-small-en-v1.5"
    WHISPER_MODEL_DIR: Path = MODELS_DIR / "whisper-tiny"
    LLM_MODEL_DIR: Path = MODELS_DIR / "phi-3-mini"
    GEMINI_API_KEY: str = ""
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    OLLAMA_ENDPOINT: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "phi3"

    # ── Ingestion ────────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 512          # tokens per chunk
    CHUNK_OVERLAP: int = 64
    MAX_INGEST_WORKERS: int = 4

    # ── RAG ──────────────────────────────────────────────────────────────────
    RAG_TOP_K: int = 5
    RAG_MAX_CONTEXT_TOKENS: int = 2048
    RAG_MIN_SCORE: float = 0.35

    # ── Sync ─────────────────────────────────────────────────────────────────
    SYNC_INTERVAL_SECONDS: int = 30
    CLOUD_RELAY_URL: str = ""
    SYNC_ENDPOINT: str = ""       # Set cloud URL in .env to enable cloud sync
    SYNC_BATCH_SIZE: int = 50

    # ── Mesh ─────────────────────────────────────────────────────────────────
    MESH_UDP_PORT: int = 41234
    MESH_WS_PORT: int = 41235
    MESH_SERVICE_TYPE: str = "_cortex._tcp.local."

    # ── Data directories ─────────────────────────────────────────────────────
    DATA_DIR: Path = DATA_DIR   # root-level data/ directory

    # ── Supabase ──────────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""   # optional; needed for admin ops

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    CORS_ORIGINS: list[str] = ["http://localhost", "http://127.0.0.1"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

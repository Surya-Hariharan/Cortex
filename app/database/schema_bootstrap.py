"""Additional database bootstrap for operational tables and indexes.

This module applies idempotent SQL after ORM `create_all()` so production
instances (Supabase/Postgres) get operational tables and query-friendly indexes.
"""
from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.logging import get_logger

log = get_logger(__name__)


POSTGRES_BOOTSTRAP_SQL: list[str] = [
    # Operational settings key-value store.
    """
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # Generic background jobs table for future async workers.
    """
    CREATE TABLE IF NOT EXISTS background_jobs (
        id TEXT PRIMARY KEY,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        priority INTEGER NOT NULL DEFAULT 5,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        run_at TIMESTAMPTZ,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # Lightweight audit/event trail table.
    """
    CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        actor_id TEXT,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    # Core app indexes.
    "CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id)",
    "CREATE INDEX IF NOT EXISTS idx_projects_user_deleted ON projects(user_id, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id, status)",
    "CREATE INDEX IF NOT EXISTS idx_documents_project_deleted ON documents(project_id, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_documents_updated_at ON documents(updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_document_chunks_doc_idx ON document_chunks(document_id, chunk_index)",
    "CREATE INDEX IF NOT EXISTS idx_document_chunks_faiss_id ON document_chunks(faiss_id)",
    "CREATE INDEX IF NOT EXISTS idx_notes_user_deleted ON notes(user_id, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_notes_project_deleted ON notes(project_id, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_tasks_user_status_deleted ON tasks(user_id, status, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_tasks_project_deleted ON tasks(project_id, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)",
    "CREATE INDEX IF NOT EXISTS idx_chats_user_deleted_updated ON chats(user_id, deleted_at, updated_at)",
    "CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_sync_events_created_at ON sync_events(created_at)",
    "CREATE INDEX IF NOT EXISTS idx_sync_events_device_created ON sync_events(device_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_sync_events_entity ON sync_events(entity_type, entity_id)",
    "CREATE INDEX IF NOT EXISTS idx_sync_queue_status_schedule ON sync_queue(status, scheduled_at)",
    # Operational table indexes.
    "CREATE INDEX IF NOT EXISTS idx_background_jobs_status_run_at ON background_jobs(status, run_at)",
    "CREATE INDEX IF NOT EXISTS idx_background_jobs_type_status ON background_jobs(job_type, status)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_created ON audit_logs(entity_type, entity_id, created_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_id, created_at)",
]


async def bootstrap_operational_schema(conn: AsyncConnection, dialect: str) -> None:
    """Apply extra schema bits that ORM models intentionally do not manage."""
    if dialect != "postgresql":
        return

    for stmt in POSTGRES_BOOTSTRAP_SQL:
        await conn.execute(text(stmt))

    log.info("database.bootstrap_ready", dialect=dialect)

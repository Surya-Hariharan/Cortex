"""
Cortex — Database Connection
Async SQLAlchemy engine + session factory for SQLite (local) or
PostgreSQL (cloud). Dependency-injectable session via get_db().
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event, text

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────
_db_url = settings.DATABASE_URL or settings.SQLITE_URL
if "sqlite" in _db_url:
    _connect_args = {"check_same_thread": False}
elif "postgresql+asyncpg" in _db_url:
    # Supabase pooler (PgBouncer) can fail with duplicate prepared statements.
    # Disabling statement caches avoids that incompatibility.
    _connect_args = {
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }
else:
    _connect_args = {}


def _safe_db_url(url: str) -> str:
    """Hide credentials when logging database URLs."""
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        if "@" in rest:
            return f"{scheme}://***@{rest.split('@', 1)[1]}"
    return url

engine = create_async_engine(
    _db_url,
    connect_args=_connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

# Enable FK enforcement for every SQLite connection.
# Without this PRAGMA, SQLite silently ignores foreign-key constraints.
if "sqlite" in _db_url:
    from sqlalchemy import event

    @event.listens_for(engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON")
        cursor.execute("PRAGMA journal_mode = WAL")
        cursor.execute("PRAGMA synchronous  = NORMAL")
        cursor.close()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Base ──────────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    # Allow un-typed / bare `Mapped` annotations without raising errors;
    # our domain models use `Mapped[list]` shorthands for relationships.
    __allow_unmapped__ = True


# ── Dependency ────────────────────────────────────────────────────────────────
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# ── Lifecycle helpers ─────────────────────────────────────────────────────────
async def init_db() -> None:
    """Create all tables (if not exists) on startup."""
    from app.models.domain import (  # noqa: F401 — side-effect imports
        chat, document, note, project, sync, task, user,  # user includes PasswordResetToken
    )
    from app.database.schema_bootstrap import bootstrap_operational_schema

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await bootstrap_operational_schema(conn, dialect=engine.dialect.name)
    log.info("database.ready", url=_safe_db_url(_db_url))


async def close_db() -> None:
    await engine.dispose()
    log.info("database.closed")


@asynccontextmanager
async def get_db_context() -> AsyncGenerator[AsyncSession, None]:
    """Context manager version of get_db for use outside FastAPI request cycle."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

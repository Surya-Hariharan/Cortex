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

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

# ── Engine ────────────────────────────────────────────────────────────────────
_connect_args = {"check_same_thread": False} if "sqlite" in settings.SQLITE_URL else {}

engine = create_async_engine(
    settings.SQLITE_URL,
    connect_args=_connect_args,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


# ── Base ──────────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


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
        chat, document, note, project, sync, task, user,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("database.ready", url=settings.SQLITE_URL)


async def close_db() -> None:
    await engine.dispose()
    log.info("database.closed")

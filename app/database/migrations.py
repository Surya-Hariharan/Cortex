"""
Cortex — Database Migrations
Lightweight migration runner using raw SQL files for SQLite.
For cloud/PostgreSQL, prefer Alembic (alembic/ directory).
"""
from __future__ import annotations

import hashlib
from pathlib import Path

import aiosqlite

from app.core.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)

MIGRATIONS_DIR = Path(__file__).parent / "sql"


async def run_migrations(db_path: str | None = None) -> None:
    """Apply any unapplied SQL migration files in order."""
    path = db_path or settings.SQLITE_URL.replace("sqlite+aiosqlite:///", "")
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    async with aiosqlite.connect(path) as db:
        await db.execute(
            """CREATE TABLE IF NOT EXISTS _migrations (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                filename  TEXT    NOT NULL UNIQUE,
                checksum  TEXT    NOT NULL,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        await db.commit()

        applied = {row[0] async for row in await db.execute(
            "SELECT filename FROM _migrations"
        )}

        sql_files = sorted(MIGRATIONS_DIR.glob("*.sql")) if MIGRATIONS_DIR.exists() else []
        for sql_file in sql_files:
            if sql_file.name in applied:
                continue
            sql = sql_file.read_text(encoding="utf-8")
            checksum = hashlib.sha256(sql.encode()).hexdigest()
            await db.executescript(sql)
            await db.execute(
                "INSERT INTO _migrations (filename, checksum) VALUES (?, ?)",
                (sql_file.name, checksum),
            )
            await db.commit()
            log.info("migration.applied", file=sql_file.name)

    log.info("migrations.complete")

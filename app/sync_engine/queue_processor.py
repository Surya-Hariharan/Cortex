"""Background sync queue processor.

Runs as an asyncio task, drains the sync_queue table, and applies remote
events to local entities using the conflict resolver.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime

from app.core.config import settings
from app.core.logging import get_logger
from app.database.connection import get_db_context

logger = get_logger(__name__)

_running = False


async def _process_batch() -> int:
    """Process one batch of pending queue entries. Returns count processed."""
    async with get_db_context() as db:
        from app.sync_engine.event_store import get_pending_queue, mark_synced
        pending = await get_pending_queue(db, limit=50)
        if not pending:
            return 0

        processed_ids = []
        for entry in pending:
            try:
                await _apply_event(entry, db)
                processed_ids.append(entry.event_id)
            except Exception as exc:
                logger.warning("Queue entry failed", entry_id=entry.id, error=str(exc))
                entry.attempts += 1
                entry.last_error = str(exc)[:255]
                if entry.attempts >= 5:
                    entry.status = "error"
                db.add(entry)

        if processed_ids:
            await mark_synced(processed_ids, db)

        return len(processed_ids)


async def _apply_event(queue_entry, db) -> None:
    """Apply a single sync event to the local database."""
    from sqlalchemy import select, text
    from app.models.domain.sync import SyncEvent

    stmt = select(SyncEvent).where(SyncEvent.id == queue_entry.event_id)
    event = (await db.execute(stmt)).scalar_one_or_none()
    if not event:
        return

    # Apply operation to target entity
    # This is a simplified dispatcher — extend per entity_type as needed
    operation = event.operation
    entity_type = event.entity_type
    payload = json.loads(event.payload)

    if entity_type == "note":
        await _apply_note(operation, payload, db)
    elif entity_type == "task":
        await _apply_task(operation, payload, db)
    elif entity_type == "project":
        await _apply_project(operation, payload, db)
    # Additional entity types can be registered here


async def _apply_note(operation: str, payload: dict, db) -> None:
    from sqlalchemy import select
    from app.models.domain.note import Note

    note_id = payload.get("id")
    if not note_id:
        return
    existing = (await db.execute(select(Note).where(Note.id == note_id))).scalar_one_or_none()

    if operation == "delete":
        if existing:
            existing.deleted_at = datetime.utcnow()
            db.add(existing)
    elif operation in ("create", "update"):
        if existing is None:
            db.add(Note(**{k: v for k, v in payload.items() if hasattr(Note, k)}))
        else:
            for k, v in payload.items():
                if hasattr(existing, k) and k != "id":
                    setattr(existing, k, v)
            db.add(existing)
    await db.flush()


async def _apply_task(operation: str, payload: dict, db) -> None:
    from sqlalchemy import select
    from app.models.domain.task import Task

    task_id = payload.get("id")
    if not task_id:
        return
    existing = (await db.execute(select(Task).where(Task.id == task_id))).scalar_one_or_none()

    if operation == "delete":
        if existing:
            existing.deleted_at = datetime.utcnow()
            db.add(existing)
    elif operation in ("create", "update"):
        if existing is None:
            db.add(Task(**{k: v for k, v in payload.items() if hasattr(Task, k)}))
        else:
            for k, v in payload.items():
                if hasattr(existing, k) and k != "id":
                    setattr(existing, k, v)
            db.add(existing)
    await db.flush()


async def _apply_project(operation: str, payload: dict, db) -> None:
    from sqlalchemy import select
    from app.models.domain.project import Project

    proj_id = payload.get("id")
    if not proj_id:
        return
    existing = (await db.execute(select(Project).where(Project.id == proj_id))).scalar_one_or_none()

    if operation == "delete":
        if existing:
            existing.deleted_at = datetime.utcnow()
            db.add(existing)
    elif operation in ("create", "update"):
        if existing is None:
            db.add(Project(**{k: v for k, v in payload.items() if hasattr(Project, k)}))
        else:
            for k, v in payload.items():
                if hasattr(existing, k) and k != "id":
                    setattr(existing, k, v)
            db.add(existing)
    await db.flush()


async def run_queue_processor() -> None:
    """Long-running async task — poll queue every SYNC_INTERVAL_SECONDS."""
    global _running
    _running = True
    logger.info("Sync queue processor started")
    while _running:
        try:
            count = await _process_batch()
            if count:
                logger.debug("Queue batch processed", count=count)
        except Exception as exc:
            logger.error("Queue processor error", error=str(exc))
        await asyncio.sleep(settings.SYNC_INTERVAL_SECONDS)


def stop_queue_processor() -> None:
    global _running
    _running = False

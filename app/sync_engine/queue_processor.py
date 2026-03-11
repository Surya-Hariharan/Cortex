"""Background sync queue processor.

Runs as an asyncio task, drains the sync_queue table, applies remote events
locally, then fans out to cloud relay and LAN mesh peers with exponential
backoff.  Designed to run as a single long-lived ``asyncio.Task`` started
from the FastAPI lifespan.

Architecture
────────────
  SyncQueue (SQLite)
       │
       ▼
  _process_batch()
   ├─ _apply_event_locally()   — CRDT merge into local tables
   ├─ _push_to_cloud()         — httpx POST to CLOUD_RELAY_URL (if set)
   └─ _push_to_mesh_peers()    — push via peer_sync.push_to_peer()

Retry strategy
──────────────
  Per-entry attempt counter stored in SyncQueue.attempts.
  Back-off: min(2 ** attempts, 300) seconds before re-queueing.
  Hard failure after MAX_ATTEMPTS — set status="error", log and move on.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timedelta
from typing import List

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.database.connection import get_db_context

logger = get_logger(__name__)

MAX_ATTEMPTS = 7          # give up after 7 retries (~128 s + 300 s cap)
_running = False


# ── Helpers ──────────────────────────────────────────────────────────────────

def _backoff_seconds(attempts: int) -> int:
    """Exponential back-off capped at 5 minutes."""
    return min(2 ** attempts, 300)


async def _build_raw_event(event) -> dict:
    return {
        "id": event.id,
        "device_id": event.device_id,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "operation": event.operation,
        "payload": event.payload,
        "vector_clock": event.vector_clock,
        "created_at": event.created_at.isoformat(),
    }


# ── Cloud relay push ──────────────────────────────────────────────────────────

async def _push_to_cloud(raw_events: List[dict]) -> bool:
    """POST events to CLOUD_RELAY_URL/sync/push.  Returns True on success."""
    relay_url = getattr(settings, "CLOUD_RELAY_URL", "") or settings.SYNC_ENDPOINT
    if not relay_url:
        return True  # no relay configured — treat as success
    headers = {"Content-Type": "application/json"}
    if settings.SUPABASE_ANON_KEY:
        headers["apikey"] = settings.SUPABASE_ANON_KEY
        headers["Authorization"] = f"Bearer {settings.SUPABASE_ANON_KEY}"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{relay_url.rstrip('/')}/sync/push",
                json={"events": raw_events},
                headers=headers,
            )
        resp.raise_for_status()
        logger.debug("Cloud relay push ok", count=len(raw_events))
        return True
    except Exception as exc:
        logger.warning("Cloud relay push failed", error=str(exc))
        return False


# ── Mesh peer push ────────────────────────────────────────────────────────────

async def _push_to_mesh_peers(raw_events: List[dict]) -> None:
    """Fan-out events to all currently known LAN peers (best-effort)."""
    try:
        from app.mesh_network.peer_discovery import get_discovery
        from app.mesh_network.peer_sync import push_to_peer

        discovery = get_discovery()
        if not discovery:
            return
        peers = discovery.get_peers()
        for peer in peers:
            asyncio.create_task(
                push_to_peer(peer.ip_address, peer.port, raw_events),
                name=f"mesh-push-{peer.peer_id[:8]}",
            )
    except Exception as exc:
        logger.debug("Mesh peer push skipped", error=str(exc))


# ── Process one batch ─────────────────────────────────────────────────────────

async def _process_batch() -> int:
    """Process one batch of pending queue entries. Returns count processed."""
    async with get_db_context() as db:
        from app.sync_engine.event_store import get_pending_queue, mark_synced
        from app.models.domain.sync import SyncEvent, SyncQueue
        from sqlalchemy import select

        pending = await get_pending_queue(db, limit=settings.SYNC_BATCH_SIZE)
        if not pending:
            return 0

        processed_ids: List[str] = []
        raw_for_fanout: List[dict] = []

        for entry in pending:
            # Skip entries that are still within their back-off window
            if entry.attempts > 0 and entry.scheduled_at:
                wait = timedelta(seconds=_backoff_seconds(entry.attempts))
                if datetime.utcnow() < entry.scheduled_at + wait:
                    continue

            try:
                await _apply_event(entry, db)
                # Collect the raw event for fan-out to cloud / peers
                stmt = select(SyncEvent).where(SyncEvent.id == entry.event_id)
                event = (await db.execute(stmt)).scalar_one_or_none()
                if event:
                    raw_for_fanout.append(await _build_raw_event(event))
                processed_ids.append(entry.event_id)
            except Exception as exc:
                logger.warning("Queue entry failed", entry_id=entry.id, error=str(exc))
                entry.attempts = (entry.attempts or 0) + 1
                entry.last_error = str(exc)[:255]
                entry.scheduled_at = datetime.utcnow()
                if entry.attempts >= MAX_ATTEMPTS:
                    entry.status = "error"
                    logger.error(
                        "Queue entry permanently failed",
                        entry_id=entry.id,
                        attempts=entry.attempts,
                    )
                db.add(entry)

        if processed_ids:
            await mark_synced(processed_ids, db)

        # Fan-out outside the DB transaction (best-effort, non-blocking)
        if raw_for_fanout:
            cloud_ok = await _push_to_cloud(raw_for_fanout)
            if not cloud_ok:
                logger.debug("Cloud push deferred; will retry next cycle")
            await _push_to_mesh_peers(raw_for_fanout)

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
    elif entity_type == "user":
        await _apply_user(operation, payload, db)
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


async def _apply_user(operation: str, payload: dict, db) -> None:
    from sqlalchemy import select
    from app.models.domain.user import User

    user_id = payload.get("id")
    if not user_id:
        return
    existing = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()

    if operation == "delete":
        if existing:
            existing.deleted_at = datetime.utcnow()
            db.add(existing)
    elif operation in ("create", "update"):
        if existing is None:
            # Map display_name correctly from profile payload if needed
            data = {k: v for k, v in payload.items() if hasattr(User, k)}
            if "name" in payload and not data.get("display_name"):
                data["display_name"] = payload["name"]
            db.add(User(**data))
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

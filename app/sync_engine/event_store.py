"""Sync event store — wraps the sync_events table."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.domain.sync import SyncEvent, SyncQueue
from app.models.schemas.sync import SyncEventCreate
from app.core.logging import get_logger

logger = get_logger(__name__)


async def record_event(data: SyncEventCreate, db: AsyncSession) -> SyncEvent:
    """Record a new sync event and enqueue it for sync."""
    event = SyncEvent(
        id=str(uuid.uuid4()),
        device_id=data.device_id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        operation=data.operation,
        payload=json.dumps(data.payload),
        vector_clock=json.dumps(data.vector_clock),
    )
    db.add(event)
    await db.flush()

    queue_entry = SyncQueue(
        id=str(uuid.uuid4()),
        event_id=event.id,
    )
    db.add(queue_entry)
    await db.commit()
    await db.refresh(event)
    logger.debug("SyncEvent recorded", id=event.id, op=data.operation, entity=data.entity_type)
    return event


async def get_events_since(
    since: Optional[datetime],
    db: AsyncSession,
    device_id: Optional[str] = None,
    limit: int = 200,
) -> List[SyncEvent]:
    """Fetch events newer than `since`, optionally filtering by device."""
    stmt = select(SyncEvent)
    if since:
        stmt = stmt.where(SyncEvent.created_at > since)
    if device_id:
        stmt = stmt.where(SyncEvent.device_id != device_id)  # exclude own events
    stmt = stmt.order_by(SyncEvent.created_at.asc()).limit(limit)
    return list((await db.execute(stmt)).scalars().all())


async def mark_synced(event_ids: List[str], db: AsyncSession) -> None:
    """Mark events as synced and update their queue entries."""
    from sqlalchemy import update
    now = datetime.utcnow()
    await db.execute(
        update(SyncEvent).where(SyncEvent.id.in_(event_ids)).values(synced_at=now)
    )
    await db.execute(
        update(SyncQueue).where(SyncQueue.event_id.in_(event_ids)).values(
            status="done", processed_at=now
        )
    )
    await db.commit()


async def get_pending_queue(db: AsyncSession, limit: int = 50) -> List[SyncQueue]:
    stmt = (
        select(SyncQueue)
        .where(SyncQueue.status == "pending")
        .order_by(SyncQueue.scheduled_at.asc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())

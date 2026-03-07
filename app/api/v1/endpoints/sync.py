"""Sync events push/pull endpoint."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.sync import SyncPushRequest, SyncPullResponse, SyncEventRead
from app.sync_engine.event_store import record_event, get_events_since

router = APIRouter(prefix="/sync", tags=["Sync"])


@router.post("/push")
async def push_events(request: SyncPushRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Accept incoming sync events from another device or cloud relay."""
    count = 0
    for event_data in request.events:
        await record_event(event_data, db)
        count += 1
    return {"accepted": count}


@router.get("/pull", response_model=SyncPullResponse)
async def pull_events(
    device_id: str,
    since: Optional[datetime] = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
) -> SyncPullResponse:
    """Return sync events generated after `since`, excluding this device's own events."""
    events = await get_events_since(since=since, db=db, device_id=device_id, limit=limit)
    return SyncPullResponse(
        events=[SyncEventRead.model_validate(e) for e in events],
        since=since,
        total=len(events),
    )


@router.get("/status")
async def sync_status(db: AsyncSession = Depends(get_db)) -> dict:
    """Return sync subsystem status: pending queue depth, last event time, relay config."""
    from sqlalchemy import select, func
    from app.models.domain.sync import SyncQueue, SyncEvent

    pending_count = (
        await db.execute(
            select(func.count()).select_from(SyncQueue).where(SyncQueue.status == "pending")
        )
    ).scalar_one()

    error_count = (
        await db.execute(
            select(func.count()).select_from(SyncQueue).where(SyncQueue.status == "error")
        )
    ).scalar_one()

    latest_event = (
        await db.execute(
            select(SyncEvent.created_at).order_by(SyncEvent.created_at.desc()).limit(1)
        )
    ).scalar_one_or_none()

    from app.core.config import settings
    relay_configured = bool(
        getattr(settings, "CLOUD_RELAY_URL", "") or settings.SYNC_ENDPOINT
    )

    # Mesh peers
    peers = []
    try:
        from app.mesh_network.peer_discovery import get_discovery
        disc = get_discovery()
        if disc:
            peers = [p.peer_id for p in disc.get_peers()]
    except Exception:
        pass

    return {
        "pending_queue_depth": pending_count,
        "error_queue_depth": error_count,
        "latest_event_at": latest_event.isoformat() if latest_event else None,
        "cloud_relay_configured": relay_configured,
        "mesh_peers": peers,
        "mesh_peer_count": len(peers),
    }

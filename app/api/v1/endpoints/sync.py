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

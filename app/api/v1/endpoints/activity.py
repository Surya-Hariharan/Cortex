"""Activity and analytics endpoints — real data from DB."""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.domain.document import Document
from app.models.domain.note import Note
from app.models.domain.sync import SyncEvent

router = APIRouter(prefix="/activity", tags=["Activity"])


@router.get("/stats")
async def get_stats(user_id: str, db: AsyncSession = Depends(get_db)) -> dict:
    """Aggregated activity statistics for a user."""
    doc_count = (
        await db.execute(
            select(func.count()).where(
                Document.user_id == user_id,
                Document.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    chunk_sum = (
        await db.execute(
            select(func.coalesce(func.sum(Document.chunk_count), 0)).where(
                Document.user_id == user_id,
                Document.deleted_at.is_(None),
            )
        )
    ).scalar_one()

    shared_count = (
        await db.execute(
            select(func.count()).where(
                Note.user_id == user_id,
                Note.visibility.in_(["public", "link_only"]),
            )
        )
    ).scalar_one()

    note_count = (
        await db.execute(
            select(func.count()).where(Note.user_id == user_id)
        )
    ).scalar_one()

    return {
        "total_uploads": doc_count,
        "total_chunks": int(chunk_sum),
        "total_shared": shared_count,
        "total_notes": note_count,
    }


@router.get("/chart")
async def get_chart(
    user_id: str,
    range: str = Query("7d", pattern="^(7d|1m|3m)$"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Daily upload counts for the activity chart."""
    days = {"7d": 7, "1m": 30, "3m": 90}[range]
    now = datetime.utcnow()
    since = now - timedelta(days=days)

    result = await db.execute(
        select(Document.created_at).where(
            Document.user_id == user_id,
            Document.created_at >= since,
            Document.deleted_at.is_(None),
        )
    )
    rows = result.fetchall()

    # Build day-keyed counts (last N days)
    counts: dict[str, int] = {}
    for i in range(days):
        day = (since + timedelta(days=i + 1)).strftime("%Y-%m-%d")
        counts[day] = 0

    for (dt,) in rows:
        if dt:
            key = dt.strftime("%Y-%m-%d")
            if key in counts:
                counts[key] += 1

    labels = list(counts.keys())
    values = list(counts.values())

    # Friendly short labels for display (e.g. "Mar 13")
    short_labels = []
    for lbl in labels:
        dt = datetime.strptime(lbl, "%Y-%m-%d")
        short_labels.append(dt.strftime("%b %-d") if range == "7d" else dt.strftime("%b %d"))

    return {
        "range": range,
        "days": days,
        "labels": short_labels,
        "values": values,
        "max": max(values) if values else 0,
        "total": sum(values),
    }


@router.get("/feed")
async def get_feed(limit: int = 30, db: AsyncSession = Depends(get_db)) -> dict:
    """Recent mesh network sync events as an activity feed."""
    result = await db.execute(
        select(SyncEvent).order_by(SyncEvent.created_at.desc()).limit(limit)
    )
    events = result.scalars().all()

    feed = [
        {
            "id": ev.id,
            "entity_type": ev.entity_type,
            "entity_id": ev.entity_id,
            "operation": ev.operation,
            "device_id": ev.device_id,
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
        }
        for ev in events
    ]
    return {"feed": feed, "total": len(feed)}

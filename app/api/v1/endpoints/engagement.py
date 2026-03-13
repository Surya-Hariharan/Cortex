"""Engagement tracking — views, unique downloads, peer ratings.

POST /engagement/view       — record a file view
POST /engagement/download   — record a unique download (triggers milestones)
POST /engagement/rate       — upsert a peer rating (1-5)
GET  /engagement/stats/{entity_type}/{entity_id} — aggregated stats
"""
from __future__ import annotations

from typing import Optional
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.domain.engagement import (
    FileDownload, FileRating, FileView, Notification,
)

router = APIRouter(prefix="/engagement", tags=["Engagement"])

MILESTONE_THRESHOLDS = {10, 50, 100, 500, 1000, 2500, 5000, 10000}


def _uid() -> str:
    return str(uuid.uuid4())


async def _push_notif(
    db: AsyncSession,
    user_id: str,
    notif_type: str,
    title: str,
    description: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
) -> None:
    db.add(Notification(
        id=_uid(),
        user_id=user_id,
        type=notif_type,
        title=title,
        description=description,
        entity_type=entity_type,
        entity_id=entity_id,
    ))


# ── View ──────────────────────────────────────────────────────────────────────

@router.post("/view")
async def record_view(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Record a file view. Returns the new total view count."""
    db.add(FileView(
        id=_uid(),
        viewer_id=payload["viewer_id"],
        entity_type=payload.get("entity_type", "document"),
        entity_id=payload["entity_id"],
        owner_id=payload["owner_id"],
    ))
    await db.flush()
    total = (await db.execute(
        select(func.count()).where(
            FileView.entity_type == payload.get("entity_type", "document"),
            FileView.entity_id == payload["entity_id"],
        )
    )).scalar_one()
    return {"ok": True, "total_views": total}


# ── Download ─────────────────────────────────────────────────────────────────

@router.post("/download")
async def record_download(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Record a unique download per user. Fires milestone notifications."""
    downloader_id: str = payload["downloader_id"]
    entity_type: str = payload.get("entity_type", "document")
    entity_id: str = payload["entity_id"]
    owner_id: str = payload["owner_id"]
    entity_title: str = payload.get("entity_title", "a file")

    # Check if this user already downloaded this file
    already = (await db.execute(
        select(func.count()).where(
            FileDownload.downloader_id == downloader_id,
            FileDownload.entity_type == entity_type,
            FileDownload.entity_id == entity_id,
        )
    )).scalar_one()

    is_new = already == 0
    if is_new:
        db.add(FileDownload(
            id=_uid(),
            downloader_id=downloader_id,
            entity_type=entity_type,
            entity_id=entity_id,
            owner_id=owner_id,
        ))
        await db.flush()

        # Notify the downloader
        await _push_notif(
            db, downloader_id, "download",
            "Download successful",
            f"You downloaded \"{entity_title}\" successfully.",
            entity_type, entity_id,
        )

    # Total unique downloads for this entity (always re-count)
    total = (await db.execute(
        select(func.count()).where(
            FileDownload.entity_type == entity_type,
            FileDownload.entity_id == entity_id,
        )
    )).scalar_one()

    # Milestone check — only on new downloads, only when threshold is hit
    if is_new and total in MILESTONE_THRESHOLDS:
        await _push_notif(
            db, owner_id, "milestone",
            f"🎉 Your content was downloaded {total:,} times!",
            (
                f'Congratulations! Your notes "{entity_title}" have been downloaded '
                f"{total:,} times and are helping learners worldwide."
            ),
            entity_type, entity_id,
        )

    return {"ok": True, "is_new": is_new, "total_downloads": total}


# ── Rate ─────────────────────────────────────────────────────────────────────

@router.post("/rate")
async def rate_entity(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Upsert a peer rating (1–5 stars) for a file."""
    rater_id: str = payload["rater_id"]
    entity_type: str = payload.get("entity_type", "document")
    entity_id: str = payload["entity_id"]
    owner_id: str = payload["owner_id"]
    score: int = int(payload["score"])
    entity_title: str = payload.get("entity_title", "a file")

    if not 1 <= score <= 5:
        raise HTTPException(status_code=422, detail="score must be between 1 and 5")

    existing = (await db.execute(
        select(FileRating).where(
            FileRating.rater_id == rater_id,
            FileRating.entity_type == entity_type,
            FileRating.entity_id == entity_id,
        )
    )).scalar_one_or_none()

    is_new = existing is None
    if existing:
        existing.score = score
    else:
        db.add(FileRating(
            id=_uid(),
            rater_id=rater_id,
            entity_type=entity_type,
            entity_id=entity_id,
            owner_id=owner_id,
            score=score,
        ))
        await db.flush()

    # Notify the owner on new ratings only
    if is_new:
        await _push_notif(
            db, owner_id, "rating",
            f"Someone rated your content {score}★",
            f'Your notes "{entity_title}" received a {score}-star rating.',
            entity_type, entity_id,
        )

    avg = (await db.execute(
        select(func.avg(FileRating.score)).where(
            FileRating.entity_type == entity_type,
            FileRating.entity_id == entity_id,
        )
    )).scalar_one()

    return {"ok": True, "avg_rating": round(float(avg or 0), 2)}


# ── Aggregated stats for one entity ──────────────────────────────────────────

@router.get("/stats/{entity_type}/{entity_id}")
async def entity_stats(
    entity_type: str,
    entity_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return view / download / rating aggregates for a single entity."""
    views = (await db.execute(
        select(func.count()).where(
            FileView.entity_type == entity_type,
            FileView.entity_id == entity_id,
        )
    )).scalar_one()

    downloads = (await db.execute(
        select(func.count()).where(
            FileDownload.entity_type == entity_type,
            FileDownload.entity_id == entity_id,
        )
    )).scalar_one()

    avg_rating = (await db.execute(
        select(func.avg(FileRating.score)).where(
            FileRating.entity_type == entity_type,
            FileRating.entity_id == entity_id,
        )
    )).scalar_one()

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "total_views": views,
        "total_downloads": downloads,
        "avg_rating": round(float(avg_rating or 0), 2),
    }

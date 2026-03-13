"""Notifications CRUD endpoints."""
from __future__ import annotations

from typing import Optional
import uuid

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.domain.engagement import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _uid() -> str:
    return str(uuid.uuid4())


def _notif_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "user_id": n.user_id,
        "type": n.type,
        "title": n.title,
        "description": n.description,
        "entity_type": n.entity_type,
        "entity_id": n.entity_id,
        "read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("")
async def list_notifications(
    user_id: str,
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all non-deleted notifications for a user, newest first."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id, Notification.is_deleted.is_(False))
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    notifs = result.scalars().all()
    return {
        "notifications": [_notif_dict(n) for n in notifs],
        "total": len(notifs),
        "unread": sum(1 for n in notifs if not n.is_read),
    }


@router.post("")
async def create_notification(
    user_id: str,
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a notification for a user."""
    notif = Notification(
        id=_uid(),
        user_id=user_id,
        type=payload.get("type", "system"),
        title=payload["title"],
        description=payload.get("description"),
        entity_type=payload.get("entity_type"),
        entity_id=payload.get("entity_id"),
    )
    db.add(notif)
    await db.flush()
    return _notif_dict(notif)


@router.patch("/{notif_id}/read")
async def mark_read(
    notif_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark a single notification as read."""
    await db.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == user_id)
        .values(is_read=True)
    )
    return {"ok": True}


@router.patch("/read-all")
async def mark_all_read(
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark all notifications as read for a user."""
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_deleted.is_(False))
        .values(is_read=True)
    )
    return {"ok": True, "updated": result.rowcount}


@router.delete("/{notif_id}")
async def delete_notification(
    notif_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Soft-delete a single notification."""
    await db.execute(
        update(Notification)
        .where(Notification.id == notif_id, Notification.user_id == user_id)
        .values(is_deleted=True)
    )
    return {"ok": True}


@router.delete("")
async def delete_all_notifications(
    user_id: str,
    notif_type: Optional[str] = Query(None, alias="type"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Soft-delete all notifications for a user (optionally filtered by type)."""
    conditions = [Notification.user_id == user_id, Notification.is_deleted.is_(False)]
    if notif_type:
        conditions.append(Notification.type == notif_type)
    result = await db.execute(
        update(Notification).where(*conditions).values(is_deleted=True)
    )
    return {"ok": True, "deleted": result.rowcount}

"""Study Group service — CRUD + business logic."""
from __future__ import annotations

import secrets
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.logging import get_logger
from app.models.domain.group import GroupMember, GroupMessage, StudyGroup
from app.models.schemas.group import GroupCreate, GroupMessageCreate, GroupUpdate

logger = get_logger(__name__)


# ── Internal helper ───────────────────────────────────────────────────────────

async def _load_group(group_id: str, db: AsyncSession) -> StudyGroup | None:
    result = await db.execute(
        select(StudyGroup)
        .where(StudyGroup.id == group_id, StudyGroup.deleted_at.is_(None))
        .options(selectinload(StudyGroup.members))
    )
    return result.scalar_one_or_none()


# ── Group CRUD ────────────────────────────────────────────────────────────────

async def create_group(data: GroupCreate, db: AsyncSession) -> StudyGroup:
    invite_code = secrets.token_urlsafe(8)
    group = StudyGroup(
        id=str(uuid.uuid4()),
        name=data.name,
        description=data.description,
        creator_id=data.creator_id,
        invite_code=invite_code,
        color=data.color or "from-blue-500 to-blue-600",
        messaging_mode="everyone",
    )
    db.add(group)
    await db.flush()  # get group.id first

    admin = GroupMember(
        id=str(uuid.uuid4()),
        group_id=group.id,
        user_id=data.creator_id,
        name=data.creator_name,
        role="admin",
    )
    db.add(admin)
    await db.flush()

    # Reload with members eager-loaded
    return await _load_group(group.id, db)  # type: ignore[return-value]


async def get_group(group_id: str, db: AsyncSession) -> StudyGroup | None:
    return await _load_group(group_id, db)


async def list_user_groups(user_id: str, db: AsyncSession) -> list[StudyGroup]:
    result = await db.execute(
        select(StudyGroup)
        .join(GroupMember, GroupMember.group_id == StudyGroup.id)
        .where(
            GroupMember.user_id == user_id,
            GroupMember.is_blocked == 0,
            StudyGroup.deleted_at.is_(None),
        )
        .options(selectinload(StudyGroup.members))
    )
    return list(result.scalars().unique().all())


async def delete_group(group_id: str, user_id: str, db: AsyncSession) -> bool:
    """Soft-delete. Admin-only."""
    group = await _load_group(group_id, db)
    if not group:
        return False
    admin = next((m for m in group.members if m.user_id == user_id), None)
    if not admin or admin.role != "admin":
        return False
    group.deleted_at = datetime.utcnow()
    return True


# ── Membership ────────────────────────────────────────────────────────────────

async def join_group(
    invite_code: str, user_id: str, user_name: str, db: AsyncSession
) -> StudyGroup | None:
    result = await db.execute(
        select(StudyGroup)
        .where(StudyGroup.invite_code == invite_code, StudyGroup.deleted_at.is_(None))
        .options(selectinload(StudyGroup.members))
    )
    group = result.scalar_one_or_none()
    if not group:
        return None

    # Already a member → return as-is
    if any(m.user_id == user_id for m in group.members):
        return group

    member = GroupMember(
        id=str(uuid.uuid4()),
        group_id=group.id,
        user_id=user_id,
        name=user_name,
        role="member",
    )
    db.add(member)
    await db.flush()
    return await _load_group(group.id, db)  # type: ignore[return-value]


async def leave_group(group_id: str, user_id: str, db: AsyncSession) -> bool:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    m = result.scalar_one_or_none()
    if not m:
        return False
    await db.delete(m)
    return True


async def block_member(
    group_id: str, target_user_id: str, admin_id: str, db: AsyncSession
) -> bool:
    group = await _load_group(group_id, db)
    if not group:
        return False
    admin = next((m for m in group.members if m.user_id == admin_id), None)
    if not admin or admin.role != "admin":
        return False
    target = next((m for m in group.members if m.user_id == target_user_id), None)
    if not target:
        return False
    target.is_blocked = 1
    return True


async def remove_member(
    group_id: str, target_user_id: str, admin_id: str, db: AsyncSession
) -> bool:
    group = await _load_group(group_id, db)
    if not group:
        return False
    admin = next((m for m in group.members if m.user_id == admin_id), None)
    if not admin or admin.role != "admin":
        return False
    return await leave_group(group_id, target_user_id, db)


# ── Settings ──────────────────────────────────────────────────────────────────

async def update_settings(
    group_id: str, data: GroupUpdate, admin_id: str, db: AsyncSession
) -> StudyGroup | None:
    group = await _load_group(group_id, db)
    if not group:
        return None
    admin = next((m for m in group.members if m.user_id == admin_id), None)
    if not admin or admin.role != "admin":
        return None
    if data.name is not None:
        group.name = data.name
    if data.description is not None:
        group.description = data.description
    if data.messaging_mode is not None:
        group.messaging_mode = data.messaging_mode
    return group


# ── Messages ──────────────────────────────────────────────────────────────────

async def get_messages(
    group_id: str, channel: str, db: AsyncSession, limit: int = 100
) -> list[GroupMessage]:
    result = await db.execute(
        select(GroupMessage)
        .where(GroupMessage.group_id == group_id, GroupMessage.channel == channel)
        .order_by(GroupMessage.created_at.asc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def send_message(
    group_id: str, data: GroupMessageCreate, db: AsyncSession
) -> GroupMessage | None:
    """Send a message, enforcing messaging_mode and blocked status."""
    group = await _load_group(group_id, db)
    if not group:
        return None

    member = next((m for m in group.members if m.user_id == data.sender_id), None)
    if not member or member.is_blocked:
        return None  # not a member or blocked

    if group.messaging_mode == "admin_only" and member.role != "admin":
        return None  # only admin can send

    msg = GroupMessage(
        id=str(uuid.uuid4()),
        group_id=group_id,
        channel=data.channel,
        sender_id=data.sender_id,
        sender_name=data.sender_name,
        content=data.content,
    )
    db.add(msg)
    await db.flush()
    return msg


async def count_messages(group_id: str, db: AsyncSession) -> int:
    result = await db.execute(
        select(func.count()).where(GroupMessage.group_id == group_id)
    )
    return result.scalar_one() or 0

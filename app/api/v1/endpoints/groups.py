"""Study Groups API endpoints."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.group import (
    GroupCreate, GroupMessageCreate, GroupMessageRead, GroupMemberRead,
    GroupRead, GroupUpdate,
)
from app.services import group_service

router = APIRouter(prefix="/groups", tags=["Groups"])


# ── Helper to serialise a group with message_count ───────────────────────────

async def _group_read(group, db: AsyncSession) -> GroupRead:
    count = await group_service.count_messages(group.id, db)
    return GroupRead(
        id=group.id,
        name=group.name,
        description=group.description,
        creator_id=group.creator_id,
        invite_code=group.invite_code,
        messaging_mode=group.messaging_mode,
        color=group.color,
        created_at=group.created_at,
        updated_at=group.updated_at,
        members=[GroupMemberRead.model_validate(m) for m in group.members],
        message_count=count,
    )


# ── Group CRUD ────────────────────────────────────────────────────────────────

@router.post("/", response_model=GroupRead, status_code=201)
async def create_group(
    data: GroupCreate, db: AsyncSession = Depends(get_db)
) -> GroupRead:
    group = await group_service.create_group(data, db)
    return await _group_read(group, db)


@router.get("/", response_model=List[GroupRead])
async def list_groups(
    user_id: str, db: AsyncSession = Depends(get_db)
) -> List[GroupRead]:
    groups = await group_service.list_user_groups(user_id, db)
    result = []
    for g in groups:
        result.append(await _group_read(g, db))
    return result


@router.get("/{group_id}", response_model=GroupRead)
async def get_group(
    group_id: str, db: AsyncSession = Depends(get_db)
) -> GroupRead:
    group = await group_service.get_group(group_id, db)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return await _group_read(group, db)


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: str, user_id: str, db: AsyncSession = Depends(get_db)
) -> None:
    ok = await group_service.delete_group(group_id, user_id, db)
    if not ok:
        raise HTTPException(status_code=403, detail="Not found or not authorised")


# ── Membership ────────────────────────────────────────────────────────────────

@router.post("/join", response_model=GroupRead)
async def join_group(
    invite_code: str,
    user_id: str,
    user_name: str,
    db: AsyncSession = Depends(get_db),
) -> GroupRead:
    group = await group_service.join_group(invite_code, user_id, user_name, db)
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    return await _group_read(group, db)


@router.delete("/{group_id}/leave", status_code=204)
async def leave_group(
    group_id: str, user_id: str, db: AsyncSession = Depends(get_db)
) -> None:
    ok = await group_service.leave_group(group_id, user_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Not a member")


@router.patch("/{group_id}/members/{member_user_id}/block", status_code=200)
async def block_member(
    group_id: str,
    member_user_id: str,
    admin_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    ok = await group_service.block_member(group_id, member_user_id, admin_id, db)
    if not ok:
        raise HTTPException(status_code=403, detail="Not found or not authorised")
    return {"status": "blocked"}


@router.delete("/{group_id}/members/{member_user_id}", status_code=204)
async def remove_member(
    group_id: str,
    member_user_id: str,
    admin_id: str,
    db: AsyncSession = Depends(get_db),
) -> None:
    ok = await group_service.remove_member(group_id, member_user_id, admin_id, db)
    if not ok:
        raise HTTPException(status_code=403, detail="Not found or not authorised")


# ── Group settings (admin only) ───────────────────────────────────────────────

@router.patch("/{group_id}/settings", response_model=GroupRead)
async def update_settings(
    group_id: str,
    admin_id: str,
    data: GroupUpdate,
    db: AsyncSession = Depends(get_db),
) -> GroupRead:
    group = await group_service.update_settings(group_id, data, admin_id, db)
    if not group:
        raise HTTPException(status_code=403, detail="Not found or not authorised")
    return await _group_read(group, db)


# ── Messages ──────────────────────────────────────────────────────────────────

@router.get("/{group_id}/messages", response_model=List[GroupMessageRead])
async def get_messages(
    group_id: str,
    channel: str = "general",
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
) -> List[GroupMessageRead]:
    msgs = await group_service.get_messages(group_id, channel, db, limit=limit)
    return [GroupMessageRead.model_validate(m) for m in msgs]


@router.post("/{group_id}/messages", response_model=GroupMessageRead, status_code=201)
async def send_message(
    group_id: str,
    data: GroupMessageCreate,
    db: AsyncSession = Depends(get_db),
) -> GroupMessageRead:
    msg = await group_service.send_message(group_id, data, db)
    if not msg:
        raise HTTPException(status_code=403, detail="Not authorised to send messages")
    return GroupMessageRead.model_validate(msg)

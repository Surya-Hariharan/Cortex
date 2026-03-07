"""Chat service — conversations + message history."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.domain.chat import Chat, Message
from app.models.schemas.chat import ChatCreate
from app.core.logging import get_logger

logger = get_logger(__name__)


async def create_chat(data: ChatCreate, db: AsyncSession) -> Chat:
    chat = Chat(id=str(uuid.uuid4()), **data.model_dump())
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat


async def get_chat(chat_id: str, db: AsyncSession, include_messages: bool = False) -> Optional[Chat]:
    from sqlalchemy.orm import selectinload
    stmt = select(Chat).where(Chat.id == chat_id, Chat.deleted_at.is_(None))
    if include_messages:
        stmt = stmt.options(selectinload(Chat.messages))
    return (await db.execute(stmt)).scalar_one_or_none()


async def list_chats(
    user_id: str,
    db: AsyncSession,
    project_id: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
) -> List[Chat]:
    from sqlalchemy import and_
    filters = [Chat.user_id == user_id, Chat.deleted_at.is_(None)]
    if project_id:
        filters.append(Chat.project_id == project_id)
    stmt = select(Chat).where(and_(*filters)).order_by(Chat.updated_at.desc()).limit(limit).offset(offset)
    return list((await db.execute(stmt)).scalars().all())


async def delete_chat(chat_id: str, db: AsyncSession) -> bool:
    chat = await get_chat(chat_id, db)
    if not chat:
        return False
    chat.deleted_at = datetime.utcnow()
    db.add(chat)
    await db.commit()
    return True


async def add_message(
    chat_id: str,
    role: str,
    content: str,
    db: AsyncSession,
    citations: Optional[str] = None,
    tokens_used: Optional[int] = None,
    latency_ms: Optional[int] = None,
) -> Message:
    msg = Message(
        id=str(uuid.uuid4()),
        chat_id=chat_id,
        role=role,
        content=content,
        citations=citations,
        tokens_used=tokens_used,
        latency_ms=latency_ms,
    )
    db.add(msg)
    # Update chat.updated_at
    chat = await get_chat(chat_id, db)
    if chat:
        chat.updated_at = datetime.utcnow()
        db.add(chat)
    await db.commit()
    await db.refresh(msg)
    return msg


async def get_messages(chat_id: str, db: AsyncSession, limit: int = 100, offset: int = 0) -> List[Message]:
    stmt = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    return list((await db.execute(stmt)).scalars().all())

"""Chats + Messages endpoint."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.chat import ChatCreate, ChatRead, MessageRead
from app.services.chat_service import (
    create_chat, get_chat, list_chats, delete_chat, get_messages,
)

router = APIRouter(prefix="/chats", tags=["Chats"])


@router.post("/", response_model=ChatRead, status_code=201)
async def create(data: ChatCreate, db: AsyncSession = Depends(get_db)) -> ChatRead:
    c = await create_chat(data, db)
    return ChatRead.model_validate(c)


@router.get("/", response_model=List[ChatRead])
async def list_all(
    user_id: str,
    project_id: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> List[ChatRead]:
    chats = await list_chats(user_id, db, project_id=project_id, limit=limit, offset=offset)
    return [ChatRead.model_validate(c) for c in chats]


@router.get("/{chat_id}", response_model=ChatRead)
async def get_one(chat_id: str, db: AsyncSession = Depends(get_db)) -> ChatRead:
    c = await get_chat(chat_id, db, include_messages=True)
    if not c:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatRead.model_validate(c)


@router.get("/{chat_id}/messages", response_model=List[MessageRead])
async def get_msgs(
    chat_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> List[MessageRead]:
    msgs = await get_messages(chat_id, db, limit=limit, offset=offset)
    return [MessageRead.model_validate(m) for m in msgs]


@router.delete("/{chat_id}", status_code=204)
async def delete(chat_id: str, db: AsyncSession = Depends(get_db)) -> None:
    ok = await delete_chat(chat_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Chat not found")

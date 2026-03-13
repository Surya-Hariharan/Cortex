"""Chats + Messages endpoint.

POST /chat           — streaming chat endpoint (SSE)
POST /chats/         — create chat session
GET  /chats/         — list chats
GET  /chats/{id}     — get chat with messages
GET  /chats/{id}/messages — paginated messages
DELETE /chats/{id}   — delete chat
"""
from __future__ import annotations

import json
from typing import AsyncGenerator, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.chat import ChatCreate, ChatRead, MessageRead, RAGQueryRequest
from app.services.chat_service import (
    create_chat, get_chat, list_chats, delete_chat, get_messages,
)

router = APIRouter(tags=["Chats"])


router = APIRouter(tags=["Chats"])


# ── POST /chat — streaming RAG chat ──────────────────────────────────────────

@router.post("/chat", tags=["Chat"])
async def streaming_chat(
    request: RAGQueryRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Streaming RAG chat endpoint.

    Sends Server-Sent Events while the LLM generates tokens.
    Each SSE event has the shape::

        data: {"type": "token", "content": "..."}\n\n

    A final ``{"type": "done", "chat_id": "...", "citations": [...]}`` event
    closes the stream.
    """
    async def _generator() -> AsyncGenerator[str, None]:
        from app.rag.pipeline import run_rag_pipeline
        from app.core.observability import rag_latency, rag_queries_total

        rag_queries_total.inc()
        try:
            with rag_latency.time():
                result = await run_rag_pipeline(request, db)

            # Stream word-by-word to simulate token streaming
            # (full token streaming requires LLM refactor; this provides
            #  incremental UX without breaking the existing LLM interface)
            words = result.message.content.split(" ")
            for i, word in enumerate(words):
                chunk = word + (" " if i < len(words) - 1 else "")
                payload = json.dumps({"type": "token", "content": chunk})
                yield f"data: {payload}\n\n"

            done_payload = json.dumps({
                "type": "done",
                "chat_id": result.chat_id,
                "citations": result.citations,
                "tokens_used": result.context_tokens,
                "model_used": result.model_used,
            })
            yield f"data: {done_payload}\n\n"
        except Exception as exc:
            error_payload = json.dumps({"type": "error", "detail": str(exc)})
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(
        _generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Standard CRUD ─────────────────────────────────────────────────────────────

@router.post("/chats/", response_model=ChatRead, status_code=201)
async def create(data: ChatCreate, db: AsyncSession = Depends(get_db)) -> ChatRead:
    c = await create_chat(data, db)
    return ChatRead.model_validate(c)


@router.get("/chats/", response_model=List[ChatRead])
async def list_all(
    user_id: str,
    project_id: Optional[str] = None,
    limit: int = 30,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> List[ChatRead]:
    chats = await list_chats(user_id, db, project_id=project_id, limit=limit, offset=offset)
    return [ChatRead.model_validate(c) for c in chats]


@router.get("/chats/{chat_id}", response_model=ChatRead)
async def get_one(chat_id: str, db: AsyncSession = Depends(get_db)) -> ChatRead:
    c = await get_chat(chat_id, db, include_messages=True)
    if not c:
        raise HTTPException(status_code=404, detail="Chat not found")
    return ChatRead.model_validate(c)


@router.get("/chats/{chat_id}/messages", response_model=List[MessageRead])
async def get_msgs(
    chat_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> List[MessageRead]:
    msgs = await get_messages(chat_id, db, limit=limit, offset=offset)
    return [MessageRead.model_validate(m) for m in msgs]


@router.delete("/chats/{chat_id}", status_code=204)
async def delete(chat_id: str, db: AsyncSession = Depends(get_db)) -> None:
    ok = await delete_chat(chat_id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Chat not found")
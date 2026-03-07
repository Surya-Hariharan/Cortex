"""Full RAG pipeline: query → retrieve → build context → generate → return."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.ai_models.model_manager import model_manager
from app.models.domain.chat import Chat, Message
from app.models.schemas.chat import RAGQueryRequest, RAGQueryResponse, MessageRead
from app.rag.retriever import semantic_search
from app.rag.context_builder import build_context
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


async def run_rag_pipeline(
    request: RAGQueryRequest,
    db: AsyncSession,
) -> RAGQueryResponse:
    """Execute the full RAG pipeline for a user query.

    Steps:
    1. Resolve or create chat session
    2. Retrieve relevant chunks from FAISS + DB
    3. Build context window with citations
    4. Generate LLM response using context
    5. Persist user + assistant messages
    6. Return response with citations
    """
    start_time = datetime.utcnow()

    # 0. Resolve chat (auto-create if not specified)
    chat_id = request.chat_id
    if not chat_id:
        import uuid as _uuid
        new_chat = Chat(
            id=str(_uuid.uuid4()),
            user_id=request.user_id,
            project_id=request.project_id,
            title=request.query[:60] + ("…" if len(request.query) > 60 else ""),
            model="phi-3-mini",
        )
        db.add(new_chat)
        await db.flush()   # get the id without fully committing yet
        chat_id = new_chat.id

    # 1. Retrieve
    results = await semantic_search(
        query=request.query,
        db=db,
        top_k=request.top_k,
        document_ids=request.document_ids,
        project_id=request.project_id,
    )

    # 2. Build context
    context_text, citations = build_context(results)

    # 3. Fetch chat history — memory-managed, token-budget-trimmed
    from app.services.conversation_memory import get_context_messages
    history = await get_context_messages(
        chat_id=chat_id,
        db=db,
        max_tokens=settings.RAG_MAX_CONTEXT_TOKENS - 512,  # reserve 512 for answer
    )

    # 4. Generate LLM response (async, offloaded to thread pool)
    gen_start = datetime.utcnow()
    answer = await model_manager.llm.agenerate(
        query=request.query,
        context=context_text or None,
        history=history,
        max_new_tokens=512,
    )
    latency_ms = int((datetime.utcnow() - gen_start).total_seconds() * 1000)

    # 5. Persist user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        chat_id=chat_id,
        role="user",
        content=request.query,
        created_at=start_time,
    )
    db.add(user_msg)

    # 6. Persist assistant message
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        chat_id=chat_id,
        role="assistant",
        content=answer,
        citations=json.dumps(citations),
        latency_ms=latency_ms,
    )
    db.add(assistant_msg)

    # 7. Update chat timestamp
    chat_stmt = select(Chat).where(Chat.id == chat_id)
    chat_row = (await db.execute(chat_stmt)).scalar_one_or_none()
    if chat_row:
        chat_row.updated_at = datetime.utcnow()
        db.add(chat_row)

    await db.commit()
    await db.refresh(assistant_msg)

    context_tokens = sum(int(len(r.content.split()) * 1.3) for r in results)

    return RAGQueryResponse(
        chat_id=chat_id,
        message=MessageRead.model_validate(assistant_msg),
        citations=citations,
        context_tokens=context_tokens,
    )

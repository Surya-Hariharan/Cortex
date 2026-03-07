"""Full RAG pipeline: query → retrieve → build context → generate → return."""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai_models.model_manager import model_manager
from app.models.domain.chat import Chat, Message
from app.models.schemas.chat import RAGQueryRequest, RAGQueryResponse, MessageRead
from app.rag.retriever import semantic_search
from app.rag.context_builder import build_context
from app.core.logging import get_logger

logger = get_logger(__name__)


async def run_rag_pipeline(
    request: RAGQueryRequest,
    db: AsyncSession,
) -> RAGQueryResponse:
    """Execute the full RAG pipeline for a user query.

    Steps:
    1. Retrieve relevant chunks from FAISS + DB
    2. Build context window with citations
    3. Generate LLM response using context
    4. Persist user + assistant messages
    5. Return response with citations
    """
    start_time = datetime.utcnow()

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

    # 3. Fetch chat history (last 6 messages for context window)
    from sqlalchemy import select, desc
    history_stmt = (
        select(Message)
        .where(Message.chat_id == request.chat_id)
        .order_by(desc(Message.created_at))
        .limit(6)
    )
    history_rows = (await db.execute(history_stmt)).scalars().all()
    history = [{"role": m.role, "content": m.content} for m in reversed(history_rows)]

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
        chat_id=request.chat_id,
        role="user",
        content=request.query,
        created_at=start_time,
    )
    db.add(user_msg)

    # 6. Persist assistant message
    assistant_msg = Message(
        id=str(uuid.uuid4()),
        chat_id=request.chat_id,
        role="assistant",
        content=answer,
        citations=json.dumps(citations),
        latency_ms=latency_ms,
    )
    db.add(assistant_msg)

    # 7. Update chat timestamp
    chat_stmt = select(Chat).where(Chat.id == request.chat_id)
    chat = (await db.execute(chat_stmt)).scalar_one_or_none()
    if chat:
        chat.updated_at = datetime.utcnow()
        db.add(chat)

    await db.commit()
    await db.refresh(assistant_msg)

    context_tokens = sum(int(len(r.content.split()) * 1.3) for r in results)

    return RAGQueryResponse(
        message=MessageRead.model_validate(assistant_msg),
        citations=citations,
        context_tokens=context_tokens,
    )

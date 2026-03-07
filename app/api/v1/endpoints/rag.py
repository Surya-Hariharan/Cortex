"""RAG query endpoint — retrieval-augmented generation."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.chat import RAGQueryRequest, RAGQueryResponse
from app.rag.pipeline import run_rag_pipeline
from app.services.chat_service import get_chat

router = APIRouter(prefix="/rag", tags=["RAG"])


@router.post("/query", response_model=RAGQueryResponse)
async def rag_query(request: RAGQueryRequest, db: AsyncSession = Depends(get_db)) -> RAGQueryResponse:
    """Execute a RAG query. Creates a new chat session if chat_id is not provided."""
    if request.chat_id:
        chat = await get_chat(request.chat_id, db)
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
    return await run_rag_pipeline(request, db)

"""Semantic search endpoint."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.connection import get_db
from app.models.schemas.search import SearchRequest, SearchResponse
from app.rag.retriever import semantic_search

router = APIRouter(prefix="/search", tags=["Search"])


@router.post("/", response_model=SearchResponse)
async def search(request: SearchRequest, db: AsyncSession = Depends(get_db)) -> SearchResponse:
    """Semantic search over indexed documents."""
    results = await semantic_search(
        query=request.query,
        db=db,
        top_k=request.top_k,
        score_threshold=request.score_threshold,
        document_ids=request.document_ids,
        project_id=request.project_id,
    )
    return SearchResponse(query=request.query, results=results, total=len(results))

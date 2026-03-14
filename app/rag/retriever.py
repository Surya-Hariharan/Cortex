"""Semantic retriever — combines embedding model + FAISS vector store."""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.ai_models.model_manager import model_manager
from app.models.domain.document import DocumentChunk, Document
from app.models.schemas.search import SearchResult
from app.rag.vector_store import vector_store
from app.core.logging import get_logger

logger = get_logger(__name__)


async def semantic_search(
    query: str,
    db: AsyncSession,
    top_k: int = 10,
    score_threshold: float = 0.3,
    document_ids: Optional[List[str]] = None,
    project_id: Optional[str] = None,
    stream: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[SearchResult]:
    """Embed query → FAISS search → enrich with DB metadata.

    Filters by ``document_ids``, ``project_id``, ``stream``, or ``user_id``
    when provided.  Stream filtering scopes retrieval to documents that were
    uploaded with a matching academic stream tag (e.g. "AI & ML").
    """
    # Embed query — return empty results if embeddings are unavailable
    try:
        query_vec = model_manager.embeddings.encode([query])[0]
    except Exception as exc:
        logger.warning("Embedding model unavailable, skipping retrieval", error=str(exc))
        return []

    # Retrieve candidates from FAISS
    candidates = vector_store.search(query_vec, top_k=top_k * 3, score_threshold=score_threshold)
    if not candidates:
        return []

    chunk_ids = [cid for cid, _ in candidates]
    score_map = {cid: score for cid, score in candidates}

    # Fetch chunks from DB with stream/user filters applied at SQL level
    stmt = (
        select(DocumentChunk, Document)
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(DocumentChunk.id.in_(chunk_ids))
        .where(Document.deleted_at.is_(None))
    )
    if document_ids:
        stmt = stmt.where(Document.id.in_(document_ids))
    if project_id:
        stmt = stmt.where(Document.project_id == project_id)
    if stream:
        stmt = stmt.where(Document.stream == stream)
    if user_id:
        stmt = stmt.where(Document.user_id == user_id)

    rows = (await db.execute(stmt)).all()

    results: List[SearchResult] = []
    for chunk, doc in rows:
        results.append(
            SearchResult(
                chunk_id=chunk.id,
                document_id=doc.id,
                document_title=doc.title,
                filename=doc.filename,
                chunk_index=chunk.chunk_index,
                page_number=chunk.page_number,
                content=chunk.content,
                score=score_map.get(chunk.id, 0.0),
                metadata={
                    "subject": doc.subject or "",
                    "stream": doc.stream or "",
                },
            )
        )

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:top_k]

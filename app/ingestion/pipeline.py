"""Ingestion pipeline — orchestrates extract → chunk → embed → store.

Usage::

    from app.ingestion.pipeline import ingest_document
    await ingest_document(document_id, db)
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.domain.document import Document, DocumentChunk
from app.ingestion.pdf_extractor import extract_file
from app.ingestion.chunker import chunk_pages
from app.ai_models.model_manager import model_manager
from app.rag.vector_store import vector_store
from app.core.logging import get_logger

logger = get_logger(__name__)


async def ingest_document(document_id: str, db: AsyncSession) -> None:
    """Full ingestion pipeline for a single document.

    1. Load Document record from DB
    2. Extract text pages from file
    3. Chunk pages
    4. Embed chunks
    5. Add embeddings to FAISS
    6. Persist DocumentChunk rows
    7. Update Document status
    """
    # Fetch document
    stmt = select(Document).where(Document.id == document_id)
    doc: Document | None = (await db.execute(stmt)).scalar_one_or_none()
    if doc is None:
        logger.error("Document not found for ingestion", id=document_id)
        return

    try:
        # Mark processing
        doc.status = "processing"
        await db.commit()

        # 1. Extract
        pages = extract_file(doc.file_path, doc.mime_type)
        page_count = len(pages)

        # 2. Chunk
        chunks = chunk_pages(pages)
        if not chunks:
            raise ValueError("No chunks produced — document may be empty or unreadable")

        # 3. Embed (batch for efficiency)
        texts = [c["text"] for c in chunks]
        embeddings = model_manager.embeddings.encode(texts)  # (N, 384)

        # 4. Build DB rows & collect IDs
        chunk_ids: list[str] = []
        db_chunks: list[DocumentChunk] = []
        for i, (chunk, _) in enumerate(zip(chunks, embeddings)):
            cid = str(uuid.uuid4())
            chunk_ids.append(cid)
            db_chunks.append(
                DocumentChunk(
                    id=cid,
                    document_id=document_id,
                    chunk_index=chunk["chunk_index"],
                    content=chunk["text"],
                    token_count=chunk.get("token_count"),
                    page_number=chunk.get("page"),
                )
            )

        # 5. FAISS add
        row_ids = vector_store.add(embeddings, chunk_ids)
        # Attach FAISS row IDs to chunks
        for db_chunk, row_id in zip(db_chunks, row_ids):
            db_chunk.faiss_id = row_id

        # 6. Persist chunks
        db.add_all(db_chunks)

        # 7. Calculate word count
        word_count = sum(len(c["text"].split()) for c in chunks)

        # 8. Update document metadata
        doc.status = "indexed"
        doc.page_count = page_count
        doc.word_count = word_count
        doc.updated_at = datetime.utcnow()
        db.add(doc)

        await db.commit()
        vector_store.save()

        logger.info(
            "Document ingested",
            id=document_id,
            pages=page_count,
            chunks=len(chunks),
            words=word_count,
        )

    except Exception as exc:
        doc.status = "error"
        doc.error_msg = str(exc)[:255]
        try:
            await db.commit()
        except Exception:
            await db.rollback()
        logger.error("Ingestion failed", id=document_id, error=str(exc))
        raise

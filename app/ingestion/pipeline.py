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
from app.ingestion.pdf_extractor import extract_document
from app.ingestion.chunker import chunk_pages
from app.ingestion.verifier import verify_content
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

        # 1. Extract (with automatic PaddleOCR fallback for scanned PDFs)
        pages, ocr_applied = extract_document(doc.file_path, doc.mime_type)
        page_count = len(pages)

        # 2. Verify content quality before embedding
        full_text = "\n".join(p.get("text", "") for p in pages)
        verification = verify_content(full_text, stream=doc.stream, filename=doc.filename)
        if not verification.is_valid:
            raise ValueError(f"Content verification failed: {verification.reason}")

        # 3. Chunk
        chunks = chunk_pages(pages)
        if not chunks:
            raise ValueError("No chunks produced — document may be empty or unreadable")

        # 4. Embed (batch for efficiency)
        texts = [c["text"] for c in chunks]
        embeddings = model_manager.embeddings.encode(texts)  # (N, 384)

        # 5. Build DB rows & collect IDs
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

        # 6. FAISS add
        row_ids = vector_store.add(embeddings, chunk_ids)
        for db_chunk, row_id in zip(db_chunks, row_ids):
            db_chunk.faiss_id = row_id

        # 7. Persist chunks
        db.add_all(db_chunks)

        # 8. Calculate word count
        word_count = sum(len(c["text"].split()) for c in chunks)

        # 9. Update document metadata
        doc.status = "indexed"
        doc.page_count = page_count
        doc.word_count = word_count
        doc.ocr_applied = int(ocr_applied)
        doc.updated_at = datetime.utcnow()
        db.add(doc)

        await db.commit()
        vector_store.save()

        logger.info(
            "Document ingested",
            id=document_id,
            stream=doc.stream or "unset",
            subject=doc.subject or "unset",
            pages=page_count,
            chunks=len(chunks),
            words=word_count,
            ocr=bool(ocr_applied),
            has_formulas=verification.has_formulas,
            has_tables=verification.has_tables,
            quality_score=f"{verification.quality_score:.2f}",
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

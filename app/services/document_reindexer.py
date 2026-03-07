"""Document re-indexing background worker.

Monitors the documents table for entries whose ``updated_at`` timestamp is
newer than their last-indexed timestamp, then re-runs the full
extract → chunk → embed → FAISS-update pipeline for those documents without
tearing down the entire index.

Index integrity is maintained by:
  1. Removing old FAISS rows for the document's existing chunks.
  2. Deleting the ``DocumentChunk`` rows from SQLite.
  3. Running fresh extraction + chunking + embedding.
  4. Adding the new vectors to FAISS under fresh row IDs.
  5. Persisting the updated index to disk.

Usage::

    from app.services.document_reindexer import start_reindexer_loop
    await start_reindexer_loop()        # call from FastAPI lifespan
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from pathlib import Path
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.logging import get_logger
from app.database.connection import get_db_context

logger = get_logger(__name__)

# How often to scan for stale documents (seconds)
_SCAN_INTERVAL = 120

_reindexer_task: asyncio.Task | None = None


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _get_stale_documents(db: AsyncSession) -> list:
    """Return documents that have been modified since their last ingestion."""
    from app.models.domain.document import Document

    stmt = select(Document).where(
        Document.status == "ready",
        Document.deleted_at.is_(None),
    )
    docs = (await db.execute(stmt)).scalars().all()

    stale = []
    for doc in docs:
        try:
            file_mtime = Path(doc.file_path).stat().st_mtime
            file_dt = datetime.utcfromtimestamp(file_mtime)
            # If file on disk is newer than the document's updated_at, re-index
            if file_dt > doc.updated_at:
                stale.append(doc)
        except FileNotFoundError:
            # File deleted externally — mark error
            doc.status = "error"
            doc.error_msg = "Source file no longer exists"
            db.add(doc)
    return stale


async def _remove_old_chunks(document_id: str, db: AsyncSession) -> List[int]:
    """Delete existing chunk rows and return their FAISS row IDs for removal."""
    from app.models.domain.document import DocumentChunk

    stmt = select(DocumentChunk).where(DocumentChunk.document_id == document_id)
    chunks = (await db.execute(stmt)).scalars().all()
    faiss_ids = [c.faiss_id for c in chunks if c.faiss_id is not None]

    await db.execute(
        delete(DocumentChunk).where(DocumentChunk.document_id == document_id)
    )
    return faiss_ids


def _remove_faiss_rows(faiss_ids: List[int]) -> None:
    """Remove specific row IDs from FAISS index (IndexFlatIP supports IDMap)."""
    if not faiss_ids:
        return
    try:
        import faiss  # type: ignore
        import numpy as np
        from app.rag.vector_store import vector_store

        with vector_store._lock:
            if hasattr(vector_store._index, "remove_ids"):
                id_array = np.array(faiss_ids, dtype=np.int64)
                vector_store._index.remove_ids(id_array)
                # Clean up maps
                for fid in faiss_ids:
                    chunk_id = vector_store._row_to_chunk.pop(fid, None)
                    if chunk_id:
                        vector_store._chunk_to_row.pop(chunk_id, None)
    except Exception as exc:
        logger.warning("FAISS row removal failed — will rebuild map", error=str(exc))


async def reindex_document(document_id: str) -> bool:
    """Re-run the full ingestion pipeline for a single document.

    Deletes old chunks first, then processes fresh, then saves FAISS.
    Returns True on success.
    """
    logger.info("Re-indexing document", id=document_id)
    async with get_db_context() as db:
        from app.models.domain.document import Document
        from sqlalchemy import select as _select

        doc = (await db.execute(_select(Document).where(Document.id == document_id))).scalar_one_or_none()
        if not doc or not Path(doc.file_path).exists():
            logger.warning("Re-index skipped — document or file missing", id=document_id)
            return False

        doc.status = "processing"
        doc.error_msg = None
        db.add(doc)
        await db.flush()

        # Remove stale chunks from DB and FAISS
        old_faiss_ids = await _remove_old_chunks(document_id, db)
        await db.flush()

    # Remove old FAISS rows outside the DB transaction
    _remove_faiss_rows(old_faiss_ids)

    # Re-run standard ingestion pipeline
    try:
        from app.ingestion.pipeline import ingest_document
        async with get_db_context() as db:
            await ingest_document(document_id, db)

        # Persist updated FAISS index
        from app.rag.vector_store import vector_store
        vector_store.save()

        logger.info("Re-index complete", id=document_id)
        return True
    except Exception as exc:
        logger.error("Re-index failed", id=document_id, error=str(exc))
        async with get_db_context() as db2:
            from app.models.domain.document import Document
            doc2 = (await db2.execute(_select(Document).where(Document.id == document_id))).scalar_one_or_none()
            if doc2:
                doc2.status = "error"
                doc2.error_msg = str(exc)[:255]
                db2.add(doc2)
                await db2.commit()
        return False


# ── Background loop ───────────────────────────────────────────────────────────

async def _scan_and_reindex() -> None:
    """One pass: find stale docs, reindex each sequentially."""
    async with get_db_context() as db:
        stale = await _get_stale_documents(db)
        await db.commit()  # persist any error status updates

    if not stale:
        return

    logger.info("Reindexer found stale documents", count=len(stale))
    for doc in stale:
        await reindex_document(doc.id)
        # Small pause between heavy CPU tasks
        await asyncio.sleep(2)


async def start_reindexer_loop(interval_seconds: int = _SCAN_INTERVAL) -> None:
    """Launch the continuous reindexer background task."""
    global _reindexer_task

    async def _loop() -> None:
        logger.info("Document reindexer started", interval=interval_seconds)
        while True:
            try:
                await _scan_and_reindex()
            except Exception as exc:
                logger.warning("Reindexer scan error", error=str(exc))
            await asyncio.sleep(interval_seconds)

    _reindexer_task = asyncio.create_task(_loop(), name="doc-reindexer")


def stop_reindexer_loop() -> None:
    global _reindexer_task
    if _reindexer_task and not _reindexer_task.done():
        _reindexer_task.cancel()

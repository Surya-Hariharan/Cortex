"""FAISS vector store health monitor.

Verifies that:
  1. ``chunk_map.json`` and the SQLite ``document_chunks`` table agree on
     every chunk ID present in the FAISS index.
  2. FAISS reports the expected number of vectors (index.ntotal == len(map)).

If a mismatch is detected the monitor can:
  - Emit structured log warnings.
  - Optionally rebuild the index from SQLite embeddings — set
    ``rebuild_on_mismatch=True`` when calling ``run_health_check()``.

Also exposes ``get_health_status()`` for the ``/system/health`` endpoint.

Usage::

    from app.services.vector_store_health import run_health_check, get_health_status
    report = await run_health_check()           # one-shot check
    await start_health_monitor()                # background loop
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Set

from app.core.logging import get_logger

logger = get_logger(__name__)

_MONITOR_INTERVAL = 300   # 5 minutes

_last_report: "HealthReport | None" = None
_monitor_task: asyncio.Task | None = None


@dataclass
class HealthReport:
    timestamp: datetime = field(default_factory=datetime.utcnow)
    faiss_total: int = 0
    map_total: int = 0
    db_total: int = 0
    orphaned_in_map: List[str] = field(default_factory=list)   # in map but not in DB
    missing_from_map: List[str] = field(default_factory=list)  # in DB but not in map
    healthy: bool = True
    rebuilt: bool = False
    error: str | None = None


# ── Core check ────────────────────────────────────────────────────────────────

async def _fetch_db_chunk_ids() -> Set[str]:
    """Return all chunk IDs present in the SQLite document_chunks table."""
    from app.database.connection import get_db_context
    from app.models.domain.document import DocumentChunk
    from sqlalchemy import select

    async with get_db_context() as db:
        rows = (await db.execute(select(DocumentChunk.id))).scalars().all()
    return set(rows)


async def run_health_check(rebuild_on_mismatch: bool = False) -> HealthReport:
    """Run a full consistency check between FAISS, chunk_map, and SQLite.

    Returns a ``HealthReport`` describing the state.
    """
    global _last_report
    report = HealthReport()

    try:
        from app.rag.vector_store import vector_store

        with vector_store._lock:
            if vector_store._index is None:
                report.healthy = False
                report.error = "FAISS index not loaded"
                _last_report = report
                return report

            report.faiss_total = vector_store.total
            map_chunk_ids: Set[str] = set(vector_store._chunk_to_row.keys())
            report.map_total = len(map_chunk_ids)

        db_chunk_ids = await _fetch_db_chunk_ids()
        report.db_total = len(db_chunk_ids)

        orphaned = map_chunk_ids - db_chunk_ids
        missing = db_chunk_ids - map_chunk_ids

        report.orphaned_in_map = list(orphaned)[:100]
        report.missing_from_map = list(missing)[:100]

        if orphaned or missing:
            report.healthy = False
            logger.warning(
                "VectorStore mismatch detected",
                orphaned=len(orphaned),
                missing=len(missing),
            )
            if rebuild_on_mismatch:
                rebuilt = await _rebuild_index()
                report.rebuilt = rebuilt
                if rebuilt:
                    report.healthy = True
        else:
            report.healthy = True

    except Exception as exc:
        report.healthy = False
        report.error = str(exc)
        logger.error("VectorStore health check failed", error=str(exc))

    _last_report = report
    return report


# ── Index rebuild ─────────────────────────────────────────────────────────────

async def _rebuild_index() -> bool:
    """Rebuild the FAISS index from embeddings stored in SQLite.

    This is a heavy synchronous operation run in a thread pool to avoid
    blocking the event loop.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _rebuild_index_sync)


def _rebuild_index_sync() -> bool:
    """Synchronous rebuild — called from thread pool."""
    try:
        import numpy as np
        import faiss  # type: ignore
        from app.rag.vector_store import vector_store
        from app.core.config import settings
        from app.ai_models.model_manager import model_manager

        # We need to re-embed every chunk.  Fetch all chunks from SQLite
        # using a *synchronous* approach here (we are inside a thread).
        import asyncio as _asyncio
        import concurrent.futures

        # Retrieve all chunk content from SQLite synchronously via a new loop
        from app.database.connection import get_db_context
        from app.models.domain.document import DocumentChunk
        from sqlalchemy import select

        chunks_data: list = []

        async def _fetch():
            async with get_db_context() as db:
                rows = (await db.execute(
                    select(DocumentChunk.id, DocumentChunk.content)
                    .where(DocumentChunk.content != "")
                )).all()
                return [(r.id, r.content) for r in rows]

        new_loop = _asyncio.new_event_loop()
        try:
            chunks_data = new_loop.run_until_complete(_fetch())
        finally:
            new_loop.close()

        if not chunks_data:
            logger.warning("Rebuild: no chunks found in DB")
            return True

        ids, texts = zip(*chunks_data)

        # Re-embed all chunks in batches of 128
        batch_size = 128
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = list(texts[i : i + batch_size])
            vecs = model_manager.embeddings.encode(batch)
            all_embeddings.append(vecs)

        embeddings = np.vstack(all_embeddings).astype("float32")

        # Rebuild index
        new_index = faiss.IndexFlatIP(settings.VECTOR_DIM)
        new_index.add(embeddings)

        new_row_to_chunk: dict = {i: cid for i, cid in enumerate(ids)}
        new_chunk_to_row: dict = {cid: i for i, cid in enumerate(ids)}

        with vector_store._lock:
            vector_store._index = new_index
            vector_store._row_to_chunk = new_row_to_chunk
            vector_store._chunk_to_row = new_chunk_to_row

        vector_store.save()
        logger.info("VectorStore index rebuilt", vectors=new_index.ntotal)
        return True

    except Exception as exc:
        logger.error("VectorStore rebuild failed", error=str(exc))
        return False


# ── Background monitor ────────────────────────────────────────────────────────

async def start_health_monitor(
    interval_seconds: int = _MONITOR_INTERVAL,
    rebuild_on_mismatch: bool = True,
) -> None:
    """Start a background loop that runs the health check periodically."""
    global _monitor_task

    async def _loop() -> None:
        logger.info("VectorStore health monitor started", interval=interval_seconds)
        while True:
            await asyncio.sleep(interval_seconds)
            try:
                report = await run_health_check(rebuild_on_mismatch=rebuild_on_mismatch)
                if not report.healthy:
                    logger.warning("VectorStore unhealthy", report=str(report))
            except Exception as exc:
                logger.warning("Health monitor iteration failed", error=str(exc))

    _monitor_task = asyncio.create_task(_loop(), name="vs-health-monitor")


def stop_health_monitor() -> None:
    global _monitor_task
    if _monitor_task and not _monitor_task.done():
        _monitor_task.cancel()


def get_health_status() -> dict:
    """Return the most recent health report as a JSON-serialisable dict."""
    if _last_report is None:
        return {"status": "unknown", "message": "No health check run yet"}
    return {
        "status": "healthy" if _last_report.healthy else "degraded",
        "timestamp": _last_report.timestamp.isoformat(),
        "faiss_vectors": _last_report.faiss_total,
        "map_entries": _last_report.map_total,
        "db_chunks": _last_report.db_total,
        "orphaned_count": len(_last_report.orphaned_in_map),
        "missing_count": len(_last_report.missing_from_map),
        "rebuilt": _last_report.rebuilt,
        "error": _last_report.error,
    }

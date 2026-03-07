"""Observability layer — Prometheus metrics + structured timing helpers.

Exposes a ``/metrics`` endpoint via the ``prometheus_client`` ASGI app.
All metrics are also available as Python context managers for easy
instrumentation throughout the codebase.

Graceful degradation
────────────────────
If ``prometheus_client`` is not installed the module still loads and all
helpers become no-ops.  The ``/metrics`` endpoint returns a 503.

Usage::

    from app.core.observability import rag_latency, ocr_latency

    async def my_rag_handler(...):
        with rag_latency.time():
            result = await run_rag_pipeline(...)

    # Or use the async context manager wrappers:
    async with timed("llm_generation"):
        answer = await model_manager.llm.agenerate(...)

Registration in FastAPI
───────────────────────
    from app.core.observability import mount_metrics
    mount_metrics(app)          # call after app = FastAPI(...)
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager, contextmanager
from typing import AsyncGenerator, Generator

from app.core.logging import get_logger

logger = get_logger(__name__)

_PROM_AVAILABLE = False
try:
    from prometheus_client import (  # type: ignore
        Counter,
        Histogram,
        Gauge,
        CONTENT_TYPE_LATEST,
        generate_latest,
        CollectorRegistry,
        REGISTRY,
    )
    _PROM_AVAILABLE = True
except ImportError:
    logger.warning("prometheus_client not installed — /metrics endpoint disabled")


# ── Metric definitions ────────────────────────────────────────────────────────

if _PROM_AVAILABLE:
    # Latency histograms (seconds)
    rag_latency = Histogram(
        "cortex_rag_query_latency_seconds",
        "End-to-end RAG query latency",
        buckets=(0.1, 0.25, 0.5, 1, 2, 5, 10, 30),
    )
    vector_search_latency = Histogram(
        "cortex_vector_search_latency_seconds",
        "FAISS semantic search latency",
        buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1),
    )
    llm_latency = Histogram(
        "cortex_llm_generation_latency_seconds",
        "LLM token generation latency",
        buckets=(0.5, 1, 2, 5, 10, 20, 60),
    )
    ocr_latency = Histogram(
        "cortex_ocr_processing_latency_seconds",
        "PaddleOCR page processing latency",
        buckets=(0.1, 0.25, 0.5, 1, 2, 5, 10),
    )
    transcription_latency = Histogram(
        "cortex_transcription_latency_seconds",
        "Whisper audio transcription latency",
        buckets=(0.5, 1, 2, 5, 10, 30, 60),
    )

    # Event counters
    mesh_sync_events = Counter(
        "cortex_mesh_sync_events_total",
        "Total mesh sync events exchanged",
        ["direction"],  # "push" or "pull"
    )
    rag_queries_total = Counter(
        "cortex_rag_queries_total",
        "Total RAG queries executed",
    )
    documents_ingested_total = Counter(
        "cortex_documents_ingested_total",
        "Total documents successfully ingested",
    )
    ocr_pages_total = Counter(
        "cortex_ocr_pages_total",
        "Total pages processed by PaddleOCR",
    )
    sync_queue_errors = Counter(
        "cortex_sync_queue_errors_total",
        "Total sync queue entries that permanently failed",
    )

    # Gauges
    faiss_vectors = Gauge(
        "cortex_faiss_vectors",
        "Number of vectors currently in the FAISS index",
    )
    active_peers = Gauge(
        "cortex_mesh_active_peers",
        "Number of currently discovered LAN peers",
    )

else:
    # Stub objects so import never fails
    class _Noop:
        def time(self): return _noop_ctx()
        def observe(self, *a, **kw): pass
        def inc(self, *a, **kw): pass
        def set(self, *a, **kw): pass
        def labels(self, *a, **kw): return self

    _noop = _Noop()
    rag_latency = vector_search_latency = llm_latency = _noop
    ocr_latency = transcription_latency = _noop
    mesh_sync_events = rag_queries_total = documents_ingested_total = _noop
    ocr_pages_total = sync_queue_errors = _noop
    faiss_vectors = active_peers = _noop


@contextmanager
def _noop_ctx() -> Generator:
    yield


# ── Async timing helpers ──────────────────────────────────────────────────────

@asynccontextmanager
async def timed(metric_name: str) -> AsyncGenerator[None, None]:
    """Async context manager: record elapsed time on a named Histogram.

    Silently no-ops if prometheus_client is unavailable or metric unknown.
    """
    metrics_map = {
        "rag": rag_latency,
        "vector_search": vector_search_latency,
        "llm": llm_latency,
        "ocr": ocr_latency,
        "transcription": transcription_latency,
    }
    metric = metrics_map.get(metric_name)
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        if metric and _PROM_AVAILABLE:
            metric.observe(elapsed)


# ── Metrics endpoint ──────────────────────────────────────────────────────────

def mount_metrics(app) -> None:
    """Register a ``/metrics`` route on a FastAPI app.

    Call this after ``app = FastAPI(...)`` in main.py.
    """
    from fastapi import Response
    from fastapi.routing import APIRoute

    if not _PROM_AVAILABLE:
        @app.get("/metrics", tags=["Observability"])
        async def metrics_unavailable() -> Response:
            return Response(
                content="prometheus_client not installed",
                status_code=503,
                media_type="text/plain",
            )
        return

    @app.get("/metrics", tags=["Observability"], include_in_schema=False)
    async def metrics() -> Response:
        data = generate_latest(REGISTRY)
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)

    logger.info("Prometheus /metrics endpoint registered")


# ── Gauge update helpers ──────────────────────────────────────────────────────

def update_faiss_gauge() -> None:
    """Refresh the faiss_vectors gauge from the live index."""
    try:
        from app.rag.vector_store import vector_store
        if vector_store._index is not None:
            faiss_vectors.set(vector_store._index.ntotal)
    except Exception:
        pass


def update_peers_gauge() -> None:
    """Refresh the active_peers gauge from mDNS discovery."""
    try:
        from app.mesh_network.peer_discovery import get_discovery
        disc = get_discovery()
        if disc:
            active_peers.set(len(disc.get_peers()))
    except Exception:
        pass

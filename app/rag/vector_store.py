"""FAISS vector store wrapper.

Manages a flat IndexFlatIP (inner-product / cosine when vectors are L2-normalised)
index persisted to disk alongside chunk-ID → FAISS-row-id mappings.

Usage::

    from app.rag.vector_store import VectorStore
    vs = VectorStore()
    vs.load()
    ids = vs.add(embeddings, chunk_ids)
    results = vs.search(query_vec, top_k=5)
    vs.save()
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

INDEX_FILE = "index.faiss"
MAP_FILE = "chunk_map.json"


class VectorStore:
    """Thread-safe FAISS IndexFlatIP wrapper with persistence."""

    def __init__(self, store_dir: str | None = None) -> None:
        self._dir = Path(store_dir or settings.VECTOR_STORE_PATH)
        self._dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._index = None
        self._row_to_chunk: Dict[int, str] = {}   # faiss row → chunk_id
        self._chunk_to_row: Dict[str, int] = {}   # chunk_id → faiss row
        self._dim = settings.VECTOR_DIM

    def _ensure_index(self) -> None:
        if self._index is None:
            import faiss  # type: ignore
            self._index = faiss.IndexFlatIP(self._dim)

    def load(self) -> None:
        """Load index + map from disk (no-op if files absent)."""
        index_path = self._dir / INDEX_FILE
        map_path = self._dir / MAP_FILE
        if index_path.exists() and map_path.exists():
            try:
                import faiss  # type: ignore
                with self._lock:
                    self._index = faiss.read_index(str(index_path))
                    mapping = json.loads(map_path.read_text())
                    self._row_to_chunk = {int(k): v for k, v in mapping.items()}
                    self._chunk_to_row = {v: int(k) for k, v in mapping.items()}
                logger.info("VectorStore loaded", vectors=self._index.ntotal)
            except Exception as exc:
                logger.warning("VectorStore load failed, starting fresh", error=str(exc))
                self._index = None
                self._row_to_chunk = {}
                self._chunk_to_row = {}
        self._ensure_index()

    def save(self) -> None:
        """Persist index + map to disk."""
        import faiss  # type: ignore
        with self._lock:
            if self._index is None:
                return
            faiss.write_index(self._index, str(self._dir / INDEX_FILE))
            (self._dir / MAP_FILE).write_text(json.dumps(self._row_to_chunk))
        logger.debug("VectorStore saved", vectors=self._index.ntotal)

    def add(self, embeddings: np.ndarray, chunk_ids: List[str]) -> List[int]:
        """Add normalised embeddings to the index.

        Returns list of FAISS row IDs assigned.
        """
        self._ensure_index()
        assert embeddings.ndim == 2 and embeddings.shape[1] == self._dim
        assert len(chunk_ids) == embeddings.shape[0]

        with self._lock:
            start_row = self._index.ntotal
            self._index.add(embeddings)
            row_ids = list(range(start_row, start_row + len(chunk_ids)))
            for row, cid in zip(row_ids, chunk_ids):
                self._row_to_chunk[row] = cid
                self._chunk_to_row[cid] = row
        return row_ids

    def search(
        self, query_vector: np.ndarray, top_k: int = 5, score_threshold: float = 0.0
    ) -> List[Tuple[str, float]]:
        """Semantic search.

        Returns list of (chunk_id, score) sorted by descending score.
        """
        self._ensure_index()
        if self._index.ntotal == 0:
            return []

        if query_vector.ndim == 1:
            query_vector = query_vector[np.newaxis, :]
        query_vector = query_vector.astype(np.float32)

        actual_k = min(top_k, self._index.ntotal)
        scores, row_ids = self._index.search(query_vector, actual_k)

        results = []
        for score, row in zip(scores[0], row_ids[0]):
            if row < 0:
                continue
            if float(score) < score_threshold:
                continue
            chunk_id = self._row_to_chunk.get(int(row))
            if chunk_id:
                results.append((chunk_id, float(score)))
        return results

    def remove(self, chunk_ids: List[str]) -> None:
        """Remove vectors by chunk_id (rebuilds index — use sparingly)."""
        rows_to_keep = [
            r for r, c in self._row_to_chunk.items() if c not in chunk_ids
        ]
        if not rows_to_keep:
            import faiss  # type: ignore
            with self._lock:
                self._index = faiss.IndexFlatIP(self._dim)
                self._row_to_chunk = {}
                self._chunk_to_row = {}
            return

        import faiss  # type: ignore
        existing_vecs = self._index.reconstruct_batch(rows_to_keep) if hasattr(self._index, "reconstruct_batch") else None
        if existing_vecs is None:
            logger.warning("Cannot reconstruct vectors for removal; skipping")
            return

        keep_ids = [self._row_to_chunk[r] for r in rows_to_keep]
        with self._lock:
            self._index = faiss.IndexFlatIP(self._dim)
            self._row_to_chunk = {}
            self._chunk_to_row = {}
            self.add(existing_vecs, keep_ids)

    @property
    def total(self) -> int:
        return self._index.ntotal if self._index else 0


# Global singleton
vector_store = VectorStore()

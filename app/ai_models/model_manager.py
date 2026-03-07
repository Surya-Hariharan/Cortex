"""Singleton model manager — lazy initialization of all AI models.

Usage::

    from app.ai_models.model_manager import model_manager
    emb = model_manager.embeddings
    llm = model_manager.llm
    stt = model_manager.whisper

Memory-aware loading
────────────────────
``model_manager.load_by_available_memory()`` inspects free RAM via psutil
and loads only the subset that fits comfortably:

  ≥ 4 GB free  → embeddings + LLM + Whisper
  ≥ 2 GB free  → embeddings + LLM
  ≥ 1 GB free  → embeddings only

Call this at startup instead of ``preload_all()`` on memory-constrained
devices.  The lazy properties are still available regardless — they just
load on first access.
"""
from __future__ import annotations

import threading
from typing import Optional

from app.ai_models.embeddings import EmbeddingModel
from app.ai_models.llm import LLMModel
from app.ai_models.whisper import WhisperModel
from app.core.logging import get_logger

logger = get_logger(__name__)

# Approximate footprint of each model in RAM (MiB)
_EMBEDDINGS_MB = 150
_LLM_MB = 2_200
_WHISPER_MB = 200


class ModelManager:
    """Thread-safe lazy singleton container for all ONNX models."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._embeddings: Optional[EmbeddingModel] = None
        self._llm: Optional[LLMModel] = None
        self._whisper: Optional[WhisperModel] = None

    @property
    def embeddings(self) -> EmbeddingModel:
        if self._embeddings is None:
            with self._lock:
                if self._embeddings is None:
                    logger.info("Loading EmbeddingModel…")
                    self._embeddings = EmbeddingModel()
        return self._embeddings

    @property
    def llm(self) -> LLMModel:
        if self._llm is None:
            with self._lock:
                if self._llm is None:
                    logger.info("Loading LLMModel…")
                    self._llm = LLMModel()
        return self._llm

    @property
    def whisper(self) -> WhisperModel:
        if self._whisper is None:
            with self._lock:
                if self._whisper is None:
                    logger.info("Loading WhisperModel…")
                    self._whisper = WhisperModel()
        return self._whisper

    def status(self) -> dict:
        return {
            "embeddings": self._embeddings is not None,
            "llm": self._llm is not None,
            "whisper": self._whisper is not None,
        }

    def preload_all(self) -> None:
        """Eagerly load all models (call at startup if desired)."""
        _ = self.embeddings
        _ = self.llm
        _ = self.whisper
        logger.info("All models pre-loaded")

    def load_by_available_memory(self) -> dict[str, bool]:
        """Selectively preload models based on current free RAM.

        Returns a dict of which models were loaded.
        """
        free_mib = _free_memory_mib()
        loaded: dict[str, bool] = {"embeddings": False, "llm": False, "whisper": False}

        if free_mib >= _EMBEDDINGS_MB + 64:
            _ = self.embeddings
            loaded["embeddings"] = True
            logger.info("EmbeddingModel pre-loaded (memory check passed)", free_mib=free_mib)
        else:
            logger.warning(
                "Skipping EmbeddingModel preload — low memory",
                free_mib=free_mib,
                needed_mib=_EMBEDDINGS_MB,
            )
            return loaded

        if free_mib >= _EMBEDDINGS_MB + _LLM_MB + 256:
            _ = self.llm
            loaded["llm"] = True
            logger.info("LLMModel pre-loaded (memory check passed)", free_mib=free_mib)
        else:
            logger.warning(
                "Skipping LLMModel preload — low memory",
                free_mib=free_mib,
                needed_mib=_LLM_MB,
            )
            return loaded

        if free_mib >= _EMBEDDINGS_MB + _LLM_MB + _WHISPER_MB + 256:
            _ = self.whisper
            loaded["whisper"] = True
            logger.info("WhisperModel pre-loaded (memory check passed)", free_mib=free_mib)
        else:
            logger.warning(
                "Skipping WhisperModel preload — low memory",
                free_mib=free_mib,
                needed_mib=_WHISPER_MB,
            )

        return loaded

    def health(self) -> dict:
        """Return a JSON-serialisable health payload for the /system/health endpoint."""
        free_mib = _free_memory_mib()
        return {
            "models": {
                "embeddings": {
                    "loaded": self._embeddings is not None,
                    "approx_mb": _EMBEDDINGS_MB,
                },
                "llm": {
                    "loaded": self._llm is not None,
                    "approx_mb": _LLM_MB,
                },
                "whisper": {
                    "loaded": self._whisper is not None,
                    "approx_mb": _WHISPER_MB,
                },
            },
            "system_free_ram_mb": free_mib,
        }


def _free_memory_mib() -> int:
    """Return available system memory in MiB.  Falls back to 0 if psutil absent."""
    try:
        import psutil  # type: ignore
        return psutil.virtual_memory().available // (1024 * 1024)
    except ImportError:
        logger.debug("psutil not installed — assuming sufficient memory")
        return 8_192  # assume 8 GiB free so all models load by default


# Global singleton
model_manager = ModelManager()

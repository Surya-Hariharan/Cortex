"""Singleton model manager — lazy initialization of all AI models.

Usage::

    from app.ai_models.model_manager import model_manager
    emb = model_manager.embeddings
    llm = model_manager.llm
    stt = model_manager.whisper
"""
from __future__ import annotations

import threading
from typing import Optional

from app.ai_models.embeddings import EmbeddingModel
from app.ai_models.llm import LLMModel
from app.ai_models.whisper import WhisperModel
from app.core.logging import get_logger

logger = get_logger(__name__)


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


# Global singleton
model_manager = ModelManager()

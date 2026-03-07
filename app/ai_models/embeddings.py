"""BGE-small-en-v1.5 ONNX embeddings.

Loads the BGE-small model from the directory configured via ``settings.BGE_MODEL_DIR``.
The directory must contain:
  - tokenizer/  (vocab.txt, tokenizer_config.json, …)
  - model.onnx  (exported encoder)

Usage::

    from app.ai_models.embeddings import EmbeddingModel
    model = EmbeddingModel()          # or get from model_manager
    vectors = model.encode(["hello world"])  # np.ndarray (N, 384)
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List

import numpy as np

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_VECTOR_DIM = settings.VECTOR_DIM


class EmbeddingModel:
    """Lazy-loaded BGE-small ONNX embedding model."""

    def __init__(self, model_dir: str | None = None) -> None:
        self._model_dir = Path(model_dir or settings.BGE_MODEL_DIR)
        self._session = None
        self._tokenizer = None

    def _load(self) -> None:
        """Load tokenizer and ONNX inference session on first use."""
        try:
            from tokenizers import Tokenizer  # type: ignore
            import onnxruntime as ort  # type: ignore
        except ImportError as exc:
            raise RuntimeError("Install 'onnxruntime' and 'tokenizers' to use EmbeddingModel") from exc

        tokenizer_path = self._model_dir / "tokenizer" / "tokenizer.json"
        if not tokenizer_path.exists():
            # Fall back to HuggingFace-style layout
            tokenizer_path = self._model_dir / "tokenizer.json"
        if not tokenizer_path.exists():
            raise FileNotFoundError(f"Tokenizer not found in {self._model_dir}")

        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))
        self._tokenizer.enable_padding(pad_id=0, pad_token="[PAD]", length=512)
        self._tokenizer.enable_truncation(max_length=512)

        model_path = self._model_dir / "model.onnx"
        if not model_path.exists():
            raise FileNotFoundError(f"model.onnx not found in {self._model_dir}")

        so = ort.SessionOptions()
        so.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "4"))
        self._session = ort.InferenceSession(
            str(model_path),
            sess_options=so,
            providers=["CPUExecutionProvider"],
        )
        logger.info("EmbeddingModel loaded", model_dir=str(self._model_dir))

    def _ensure_loaded(self) -> None:
        if self._session is None:
            self._load()

    def encode(self, texts: List[str], normalize: bool = True) -> np.ndarray:
        """Encode a list of texts into embedding vectors.

        Returns:
            np.ndarray of shape (N, VECTOR_DIM), dtype float32.
        """
        self._ensure_loaded()
        encodings = self._tokenizer.encode_batch(texts)
        input_ids = np.array([e.ids for e in encodings], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encodings], dtype=np.int64)
        token_type_ids = np.zeros_like(input_ids, dtype=np.int64)

        outputs = self._session.run(
            None,
            {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "token_type_ids": token_type_ids,
            },
        )
        # outputs[0] → (N, seq_len, hidden) or (N, hidden); use [CLS] token or mean
        last_hidden = outputs[0]
        if last_hidden.ndim == 3:
            # Mean pooling over non-padding tokens
            mask = attention_mask[:, :, np.newaxis].astype(np.float32)
            embeddings = (last_hidden * mask).sum(axis=1) / mask.sum(axis=1).clip(min=1e-9)
        else:
            embeddings = last_hidden  # already pooled

        if normalize:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True).clip(min=1e-9)
            embeddings = embeddings / norms

        return embeddings.astype(np.float32)

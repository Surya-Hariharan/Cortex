"""Phi-3-mini ONNX LLM inference.

Directory layout expected in ``settings.LLM_MODEL_DIR``:
  - tokenizer/  (tokenizer.json or sentencepiece model)
  - model.onnx  (or model_quantized.onnx)

Usage::

    from app.ai_models.llm import LLMModel
    model = LLMModel()
    response = await model.generate("What is RAG?", max_new_tokens=256)
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import AsyncIterator, List, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

CONTEXT_WINDOW = 4096
DEFAULT_SYSTEM = (
    "You are Cortex, an intelligent AI study assistant. "
    "Answer concisely and cite sources when provided."
)


class LLMModel:
    """Lazy-loaded Phi-3-mini ONNX language model."""

    def __init__(self, model_dir: str | None = None) -> None:
        self._model_dir = Path(model_dir or settings.LLM_MODEL_DIR)
        self._session = None
        self._tokenizer = None

    def _load(self) -> None:
        try:
            from tokenizers import Tokenizer  # type: ignore
            import onnxruntime as ort  # type: ignore
        except ImportError as exc:
            raise RuntimeError("Install 'onnxruntime' and 'tokenizers' to use LLMModel") from exc

        tokenizer_path = self._model_dir / "tokenizer.json"
        if not tokenizer_path.exists():
            raise FileNotFoundError(f"tokenizer.json not found in {self._model_dir}")

        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))

        onnx_candidates = ["model.onnx", "model_quantized.onnx", "decoder_model.onnx"]
        model_path: Optional[Path] = None
        for candidate in onnx_candidates:
            p = self._model_dir / candidate
            if p.exists():
                model_path = p
                break
        if model_path is None:
            raise FileNotFoundError(f"No ONNX model file found in {self._model_dir}")

        so = ort.SessionOptions()
        so.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "4"))
        self._session = ort.InferenceSession(
            str(model_path),
            sess_options=so,
            providers=["CPUExecutionProvider"],
        )
        logger.info("LLMModel loaded", model_path=str(model_path))

    def _ensure_loaded(self) -> None:
        if self._session is None:
            self._load()

    def _build_prompt(
        self,
        query: str,
        context: str | None = None,
        system: str = DEFAULT_SYSTEM,
        history: List[dict] | None = None,
    ) -> str:
        """Build Phi-3 chat-ML formatted prompt."""
        parts = [f"<|system|>\n{system}<|end|>"]
        if context:
            parts.append(f"<|system|>\nContext:\n{context}<|end|>")
        for msg in (history or []):
            role = msg.get("role", "user")
            content = msg.get("content", "")
            parts.append(f"<|{role}|>\n{content}<|end|>")
        parts.append(f"<|user|>\n{query}<|end|>\n<|assistant|>")
        return "\n".join(parts)

    def generate(
        self,
        query: str,
        context: str | None = None,
        history: List[dict] | None = None,
        max_new_tokens: int = 512,
        temperature: float = 0.7,
    ) -> str:
        """Synchronous text generation.

        Returns the full response string.
        Model must support a simple seq2seq or autoregressive ONNX interface.
        """
        self._ensure_loaded()
        import numpy as np  # type: ignore

        prompt = self._build_prompt(query, context, history=history)
        encoding = self._tokenizer.encode(prompt)
        input_ids = np.array([encoding.ids], dtype=np.int64)
        attention_mask = np.array([encoding.attention_mask], dtype=np.int64)

        # Greedy decode — works for decoder-only ONNX models that accept
        # (input_ids, attention_mask) and return (logits,) per step.
        outputs = self._session.run(
            None, {"input_ids": input_ids, "attention_mask": attention_mask}
        )
        # If model returns full sequence logits: decode argmax
        logits = outputs[0]  # (1, seq, vocab)
        token_ids = logits[0].argmax(axis=-1).tolist()
        text = self._tokenizer.decode(token_ids, skip_special_tokens=True)
        return text.strip()

    async def agenerate(
        self,
        query: str,
        context: str | None = None,
        history: List[dict] | None = None,
        max_new_tokens: int = 512,
    ) -> str:
        """Async wrapper around generate() — offloads to thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            None, lambda: self.generate(query, context, history, max_new_tokens)
        )

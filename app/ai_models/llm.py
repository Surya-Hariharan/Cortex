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
import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

CONTEXT_WINDOW = 4096
DEFAULT_SYSTEM = (
    "You are Cortex, an intelligent AI study assistant. "
    "Please break down the user's query logically. If context from the RAG pipeline is provided, "
    "synthesize it to answer the question, and clearly cite the sources using the provided citation numbers (e.g., [1]). "
    "If the user has provided their own personal shared content, consider it alongside the retrieved context to "
    "provide the best possible, comprehensive answer. Always format your output clearly and answer concisely."
)


class LLMModel:
    """Lazy-loaded Phi-3-mini ONNX language model."""

    def __init__(self, model_dir: str | None = None) -> None:
        self._model_dir = Path(model_dir or settings.LLM_MODEL_DIR)
        self._model_dir = Path(model_dir or settings.LLM_MODEL_DIR)
        self._session = None
        self._tokenizer = None
        self._mode = "onnx"  # can be "onnx", "ollama", or "gemini"

    def _load(self) -> None:
        # 1. Try Ollama local LLM first
        if settings.OLLAMA_ENDPOINT:
            try:
                with httpx.Client() as client:
                    resp = client.get(f"{settings.OLLAMA_ENDPOINT}/api/tags", timeout=2.0)
                    if resp.status_code == 200:
                        models = [m["name"] for m in resp.json().get("models", [])]
                        if any(m.startswith(settings.OLLAMA_MODEL) for m in models):
                            logger.info("Ollama LLM detected and loaded.", model=settings.OLLAMA_MODEL)
                            self._mode = "ollama"
                            return
                        else:
                            logger.warning(f"Ollama running but '{settings.OLLAMA_MODEL}' not found. Try: ollama pull {settings.OLLAMA_MODEL}")
            except Exception:
                logger.debug("Ollama not reachable on endpoint. Falling back to local ONNX.")

        # 2. Try Local ONNX Models
        try:
            from tokenizers import Tokenizer  # type: ignore
            import onnxruntime as ort  # type: ignore
        except ImportError as exc:
            raise RuntimeError("Install 'onnxruntime' and 'tokenizers' to use LLMModel") from exc

        tokenizer_path = self._model_dir / "tokenizer.json"
        if not tokenizer_path.exists():
            raise FileNotFoundError(f"tokenizer.json not found in {self._model_dir}")

        self._tokenizer = Tokenizer.from_file(str(tokenizer_path))

        try:
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
        except Exception as exc:
            # 3. Fallback to Cloud Gemini API
            if settings.GEMINI_API_KEY:
                logger.info("Failed to load local LLM, falling back to Gemini API.")
                self._mode = "gemini"
                return
            raise FileNotFoundError(f"Failed to load local LLM: {exc}")

        logger.info("LLMModel loaded", model_path=str(model_path))

    def _ensure_loaded(self) -> None:
        if self._session is None and self._mode == "onnx":
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
        
        if self._mode == "ollama":
            url = f"{settings.OLLAMA_ENDPOINT}/api/chat"
            
            # Construct Ollama messages array
            messages = []
            if 'system' in locals() and system:
                messages.append({"role": "system", "content": system})
                
            for msg in (history or []):
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
            
            final_query = query
            if context:
                final_query = f"Context:\n{context}\n\nQuery: {query}"
            
            messages.append({"role": "user", "content": final_query})
            
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "options": {
                    "temperature": temperature,
                    "num_predict": max_new_tokens
                }
            }
            try:
                with httpx.Client() as client:
                    resp = client.post(url, json=payload, timeout=60.0)
                    resp.raise_for_status()
                    data = resp.json()
                    return data.get("message", {}).get("content", "").strip()
            except Exception as e:
                logger.error("Ollama fallback failed", error=str(e))
                return "Error: Could not generate response via Ollama."

        if self._mode == "gemini":
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={settings.GEMINI_API_KEY}"
            
            # Construct Gemini 'contents' array
            contents = []
            for msg in (history or []):
                role = msg.get("role", "user")
                # Gemini roles are "user" and "model"
                gemini_role = "model" if role == "assistant" else "user"
                contents.append({"role": gemini_role, "parts": [{"text": msg.get("content", "")}]})
            
            # Combine context into the query if present
            final_query = query
            if context:
                final_query = f"Context:\n{context}\n\nQuery: {query}"
            
            contents.append({"role": "user", "parts": [{"text": final_query}]})
            
            payload = {
                "systemInstruction": {"parts": [{"text": system if 'system' in locals() else DEFAULT_SYSTEM}]},
                "contents": contents,
                "generationConfig": {
                    "temperature": temperature,
                    "maxOutputTokens": max_new_tokens
                }
            }
            try:
                with httpx.Client() as client:
                    resp = client.post(url, json=payload, timeout=60.0)
                    resp.raise_for_status()
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return parts[0].get("text", "").strip()
                    return ""
            except Exception as e:
                logger.error("Gemini LLM API fallback failed", error=str(e))
                return "Error: Could not generate response via API fallback."

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

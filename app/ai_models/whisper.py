"""Whisper ONNX speech-to-text.

Expected layout in ``settings.WHISPER_MODEL_DIR``:
  - encoder.onnx  (audio → encoder hidden states)
  - decoder.onnx  (decoder with cross-attention)
  - tokenizer/    (vocab / merges for Whisper BPE tokenizer)

Falls back to openai-whisper CPU inference if ONNX files are absent.

Usage::

    result = await whisper_model.transcribe("/path/audio.wav")
    print(result["text"])
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

SAMPLE_RATE = 16_000
N_MELS = 80
HOP_LENGTH = 160
CHUNK_SECONDS = 30


class WhisperModel:
    """Lazy-loaded Whisper ONNX transcription model."""

    def __init__(self, model_dir: str | None = None) -> None:
        self._model_dir = Path(model_dir or settings.WHISPER_MODEL_DIR)
        self._encoder = None
        self._decoder = None
        self._tokenizer = None
        self._use_onnx = False

    def _try_load_onnx(self) -> bool:
        encoder_path = self._model_dir / "encoder.onnx"
        decoder_path = self._model_dir / "decoder.onnx"
        if not (encoder_path.exists() and decoder_path.exists()):
            return False
        try:
            import onnxruntime as ort  # type: ignore

            so = ort.SessionOptions()
            so.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "2"))
            providers = ["CPUExecutionProvider"]
            self._encoder = ort.InferenceSession(str(encoder_path), sess_options=so, providers=providers)
            self._decoder = ort.InferenceSession(str(decoder_path), sess_options=so, providers=providers)
            logger.info("WhisperModel loaded via ONNX", model_dir=str(self._model_dir))
            return True
        except Exception as e:
            logger.warning("ONNX Whisper load failed, will fall back", error=str(e))
            return False

    def _ensure_loaded(self) -> None:
        if self._encoder is not None or hasattr(self, "_fallback_model"):
            return
        self._use_onnx = self._try_load_onnx()
        if not self._use_onnx:
            self._load_fallback()

    def _load_fallback(self) -> None:
        """Load openai-whisper as CPU fallback."""
        try:
            import whisper  # type: ignore
            self._fallback_model = whisper.load_model("tiny", device="cpu")
            logger.info("WhisperModel loaded via openai-whisper fallback")
        except ImportError as exc:
            raise RuntimeError(
                "Neither ONNX Whisper files nor 'openai-whisper' package found. "
                "Install it with: pip install openai-whisper"
            ) from exc

    def transcribe_sync(self, audio_path: str, language: str | None = None) -> Dict[str, Any]:
        """Synchronous transcription. Returns dict with 'text', 'language', 'segments'."""
        self._ensure_loaded()

        if not self._use_onnx:
            # openai-whisper fallback
            result = self._fallback_model.transcribe(
                audio_path,
                language=language,
                fp16=False,
            )
            return {
                "text": result["text"].strip(),
                "language": result.get("language"),
                "duration_seconds": None,
                "segments": [
                    {"start": s["start"], "end": s["end"], "text": s["text"]}
                    for s in result.get("segments", [])
                ],
            }

        # ONNX path — requires librosa or soundfile for audio loading
        try:
            import librosa  # type: ignore
            import numpy as np  # type: ignore
        except ImportError as exc:
            raise RuntimeError("Install 'librosa' for ONNX Whisper audio loading") from exc

        audio, _ = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)
        mel = librosa.feature.melspectrogram(y=audio, sr=SAMPLE_RATE, n_mels=N_MELS, hop_length=HOP_LENGTH)
        mel_db = librosa.power_to_db(mel, ref=np.max).astype(np.float32)
        mel_input = mel_db[np.newaxis, ...]  # (1, N_MELS, T)

        encoder_output = self._encoder.run(None, {"mel": mel_input})[0]
        # Simplified greedy decode assumes decoder outputs token ids
        LANG_TOKEN = 50259  # <|en|>
        TASK_TOKEN = 50358  # <|transcribe|>
        SOT = 50258
        EOT = 50257

        decoder_input_ids = np.array([[SOT, LANG_TOKEN, TASK_TOKEN]], dtype=np.int64)
        decoded_ids: List[int] = []
        for _ in range(448):
            dec_out = self._decoder.run(
                None, {"input_ids": decoder_input_ids, "encoder_hidden_states": encoder_output}
            )[0]
            next_id = int(dec_out[0, -1].argmax())
            if next_id == EOT:
                break
            decoded_ids.append(next_id)
            decoder_input_ids = np.concatenate(
                [decoder_input_ids, np.array([[next_id]], dtype=np.int64)], axis=1
            )

        # Decode using stored tokenizer if available
        text = " ".join(str(i) for i in decoded_ids)  # placeholder without tokenizer
        return {"text": text, "language": language, "duration_seconds": len(audio) / SAMPLE_RATE, "segments": []}

    async def transcribe(self, audio_path: str, language: str | None = None) -> Dict[str, Any]:
        """Async transcription offloaded to thread pool."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: self.transcribe_sync(audio_path, language))

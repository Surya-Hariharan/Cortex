"""Transcription endpoint — audio → text via Whisper."""
from __future__ import annotations

import os
import uuid

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional

from app.ai_models.model_manager import model_manager
from app.models.schemas.search import TranscriptionResponse
from app.core.config import settings

router = APIRouter(prefix="/transcription", tags=["Transcription"])


@router.post("/", response_model=TranscriptionResponse)
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
) -> TranscriptionResponse:
    """Transcribe an uploaded audio file."""
    audio_dir = os.path.join(settings.DATA_DIR, "audio_tmp")
    os.makedirs(audio_dir, exist_ok=True)

    suffix = os.path.splitext(file.filename or "audio.wav")[1] or ".wav"
    tmp_path = os.path.join(audio_dir, f"{uuid.uuid4()}{suffix}")

    content = await file.read()
    try:
        with open(tmp_path, "wb") as f:
            f.write(content)

        result = await model_manager.whisper.transcribe(tmp_path, language=language)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    return TranscriptionResponse(
        text=result.get("text", ""),
        language=result.get("language"),
        duration_seconds=result.get("duration_seconds"),
        segments=result.get("segments", []),
    )

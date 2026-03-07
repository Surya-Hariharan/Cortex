"""Token-aware sliding-window document chunker.

Usage::

    from app.ingestion.chunker import chunk_pages
    chunks = chunk_pages(pages, chunk_size=512, overlap=64)
    # chunks = [{"chunk_index": 0, "text": "...", "page": 1, "token_count": 480}, ...]
"""
from __future__ import annotations

import re
from typing import List

from app.core.config import settings


def _approx_tokens(text: str) -> int:
    """Approximate token count — roughly 0.75 tokens per word."""
    return max(1, int(len(text.split()) * 1.35))


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
    page_number: int | None = None,
) -> List[dict]:
    """Split a single string into overlapping chunks.

    Returns list of {"chunk_index": int, "text": str, "page": int|None, "token_count": int}.
    """
    size = chunk_size or settings.CHUNK_SIZE
    ovlp = overlap or settings.CHUNK_OVERLAP

    # Split on sentences to avoid cutting mid-sentence
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: List[dict] = []
    current: List[str] = []
    current_tokens = 0
    chunk_index = 0

    for sentence in sentences:
        s_tokens = _approx_tokens(sentence)
        if current_tokens + s_tokens > size and current:
            # Emit chunk
            chunk_text_str = " ".join(current)
            chunks.append(
                {
                    "chunk_index": chunk_index,
                    "text": chunk_text_str,
                    "page": page_number,
                    "token_count": current_tokens,
                }
            )
            chunk_index += 1

            # Overlap: keep last few sentences
            overlap_tokens = 0
            overlap_sentences: List[str] = []
            for s in reversed(current):
                t = _approx_tokens(s)
                if overlap_tokens + t > ovlp:
                    break
                overlap_sentences.insert(0, s)
                overlap_tokens += t
            current = overlap_sentences
            current_tokens = overlap_tokens

        current.append(sentence)
        current_tokens += s_tokens

    if current:
        chunks.append(
            {
                "chunk_index": chunk_index,
                "text": " ".join(current),
                "page": page_number,
                "token_count": current_tokens,
            }
        )

    return chunks


def chunk_pages(
    pages: List[dict],
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> List[dict]:
    """Chunk a list of page dicts from the extractor.

    Each page dict must have {"page": int, "text": str}.
    Returns a flat list with globally-ordered ``chunk_index``.
    """
    all_chunks: List[dict] = []
    global_idx = 0
    for page in pages:
        page_chunks = chunk_text(
            text=page["text"],
            chunk_size=chunk_size,
            overlap=overlap,
            page_number=page.get("page"),
        )
        for c in page_chunks:
            c["chunk_index"] = global_idx
            all_chunks.append(c)
            global_idx += 1
    return all_chunks

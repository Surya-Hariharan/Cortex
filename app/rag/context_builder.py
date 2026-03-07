"""Context window builder — assembles retrieved chunks into an LLM prompt context."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple

from app.core.config import settings
from app.models.schemas.search import SearchResult


def build_context(
    results: List[SearchResult],
    max_tokens: int | None = None,
    include_metadata: bool = True,
) -> Tuple[str, List[Dict[str, Any]]]:
    """Turn search results into a context string + citation list.

    Returns:
        context_text: str — formatted text to inject into the LLM prompt.
        citations: list of citation dicts (chunk_id, document, page, score).
    """
    if max_tokens is None:
        # Rough budget: total context window minus space for response
        max_tokens = max(256, settings.CHUNK_SIZE * settings.RAG_TOP_K)

    used_tokens = 0
    parts: List[str] = []
    citations: List[Dict[str, Any]] = []
    token_budget = max_tokens

    for i, result in enumerate(results):
        # Approximate token count as word count * 1.3
        approx_tokens = int(len(result.content.split()) * 1.3)
        if used_tokens + approx_tokens > token_budget:
            break

        citation_num = i + 1
        header = f"[{citation_num}] {result.filename}"
        if result.page_number is not None:
            header += f" p.{result.page_number}"
        if include_metadata and result.document_title:
            header += f" — {result.document_title}"

        parts.append(f"{header}\n{result.content}")

        citations.append(
            {
                "num": citation_num,
                "chunk_id": result.chunk_id,
                "document_id": result.document_id,
                "document_title": result.document_title,
                "filename": result.filename,
                "page_number": result.page_number,
                "score": round(result.score, 4),
            }
        )
        used_tokens += approx_tokens

    context_text = "\n\n---\n\n".join(parts) if parts else ""
    return context_text, citations

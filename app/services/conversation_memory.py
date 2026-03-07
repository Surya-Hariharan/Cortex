"""Conversation memory manager.

Provides context-window-aware message retrieval and history compression
for the RAG pipeline so the LLM never receives an overflow prompt.

Usage::

    from app.services.conversation_memory import get_context_messages
    messages = await get_context_messages(chat_id, db, max_tokens=1800)

    # In the RAG pipeline:
    context = memory_manager.build_prompt_context(messages)
"""
from __future__ import annotations

import json
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func

from app.models.domain.chat import Chat, Message
from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# Approximate token budget reserved for retrieved document context + LLM answer
_SYSTEM_TOKEN_RESERVE = 256


def _approx_tokens(text: str) -> int:
    """Rough token estimate: ~0.75 tokens per word."""
    return max(1, int(len(text.split()) * 1.35))


async def get_recent_messages(
    chat_id: str,
    db: AsyncSession,
    limit: int = 40,
) -> List[Message]:
    """Return the most recent `limit` messages for a chat, oldest-first."""
    stmt = (
        select(Message)
        .where(Message.chat_id == chat_id)
        .order_by(desc(Message.created_at))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return list(reversed(rows))  # chronological order


async def get_context_messages(
    chat_id: str,
    db: AsyncSession,
    max_tokens: int | None = None,
) -> List[dict]:
    """Return conversation history trimmed to fit within `max_tokens`.

    Trims oldest messages first.  If history is too long, a compressed
    summary replaces the oldest half via the LLM summarizer.

    Returns a list of ``{"role": str, "content": str}`` dicts ready for
    the prompt builder.
    """
    budget = max_tokens or settings.RAG_MAX_CONTEXT_TOKENS - _SYSTEM_TOKEN_RESERVE
    messages = await get_recent_messages(chat_id, db, limit=60)

    # Build dicts and count tokens in reverse so we keep the most recent
    history: List[dict] = [{"role": m.role, "content": m.content} for m in messages]

    total = sum(_approx_tokens(m["content"]) for m in history)
    if total <= budget:
        return history

    # Try compressing the oldest half first
    split = len(history) // 2
    older = history[:split]
    newer = history[split:]

    summary_text = await _summarise(older, db)
    compressed = [{"role": "system", "content": f"[Earlier conversation summary]\n{summary_text}"}]
    trimmed = compressed + newer

    # If still over budget, hard-trim from the oldest end
    while len(trimmed) > 1:
        total = sum(_approx_tokens(m["content"]) for m in trimmed)
        if total <= budget:
            break
        trimmed = trimmed[1:]

    return trimmed


async def _summarise(messages: List[dict], db: AsyncSession) -> str:
    """Ask the local LLM to summarise a list of conversation turns.

    Falls back to a simple concatenation if the LLM is not yet loaded.
    """
    try:
        from app.ai_models.model_manager import model_manager

        turn_text = "\n".join(
            f"{m['role'].capitalize()}: {m['content']}" for m in messages
        )
        prompt = (
            "Summarise the following conversation excerpt in 3-5 sentences, "
            "preserving the key points the user made and any answers given.\n\n"
            f"{turn_text}"
        )
        summary = await model_manager.llm.agenerate(
            system_prompt="You are a concise summariser.",
            user_prompt=prompt,
            max_new_tokens=200,
        )
        return summary.strip()
    except Exception as exc:
        logger.debug("Summarisation failed, using truncation fallback", error=str(exc))
        # Fallback: first sentence of each message
        snippets = [m["content"][:80] for m in messages]
        return " … ".join(snippets)


def build_prompt_context(history: List[dict]) -> str:
    """Convert history dicts into a plain-text block for the LLM prompt."""
    lines: List[str] = []
    for turn in history:
        role = turn.get("role", "user").capitalize()
        content = turn.get("content", "")
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


async def count_messages(chat_id: str, db: AsyncSession) -> int:
    """Return total number of messages in a chat session."""
    result = await db.execute(
        select(func.count()).select_from(Message).where(Message.chat_id == chat_id)
    )
    return result.scalar_one() or 0


async def clear_chat_history(chat_id: str, db: AsyncSession) -> int:
    """Soft-delete all messages in a chat (sets content to empty, preserves rows)."""
    from sqlalchemy import update
    result = await db.execute(
        update(Message)
        .where(Message.chat_id == chat_id)
        .values(content="[cleared]")
    )
    await db.commit()
    return result.rowcount or 0

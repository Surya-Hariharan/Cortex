"""Hybrid Intelligence Router.

Decides whether a query should be answered locally (Phi-3.5 / ONNX) or
via a cloud LLM (Gemini / Groq), and optionally grounds cloud answers in
locally retrieved RAG context.

Exposed API
-----------
- get_privacy_mode() / set_privacy_mode(enabled)
- classify_query(query) → "cloud" | "local"
- hybrid_generate(query, context, history, llm) → (answer, model_label)
"""
from __future__ import annotations

from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Module-level privacy flag (mutable at runtime) ────────────────────────────
_privacy_mode: bool = False


def get_privacy_mode() -> bool:
    return _privacy_mode


def set_privacy_mode(enabled: bool) -> None:
    global _privacy_mode
    _privacy_mode = enabled
    logger.info("Privacy mode changed", enabled=enabled)


# ── Task Classifier ────────────────────────────────────────────────────────────
_CLOUD_SIGNALS = [
    "explain", "analyze", "analyse", "synthesize", "summarize",
    "write", "draft", "compare", "contrast", "brainstorm", "generate",
    "create", "design", "code", "implement", "debug", "fix the",
    "why does", "literature", "research", "what is the difference",
    "pros and cons", "help me understand", "how does",
]

_LOCAL_SIGNALS = [
    "find", "search", "my notes", "i wrote", "remind me",
    "last time", "what did i", "show me", "list my", "my tasks",
    "my deadline", "when is", "my schedule", "todo", "my project",
    "notes on", "did i mention", "what are my",
]


def classify_query(query: str) -> str:
    """Return 'cloud' if the query benefits from external LLM, else 'local'."""
    q = query.lower()
    cloud_score = sum(1 for s in _CLOUD_SIGNALS if s in q)
    local_score = sum(1 for s in _LOCAL_SIGNALS if s in q)

    if local_score > cloud_score:
        return "local"
    # Long queries and open-ended synthesis → cloud
    if len(query.split()) > 25 or cloud_score > 0:
        return "cloud"
    return "local"


# ── Hybrid Generate ────────────────────────────────────────────────────────────

async def hybrid_generate(
    query: str,
    context: str | None,
    history: list,
    llm,
    stream: str | None = None,
) -> tuple[str, str]:
    """Generate an answer using the appropriate backend.

    ``stream`` — academic stream (e.g. "AI & ML") used to tailor the
    response format with subject-appropriate formula/table instructions.

    Returns
    -------
    (answer, model_label)  where model_label is a human-readable description.
    """
    # Build academic formatting instructions based on stream
    _ACADEMIC_INSTRUCT = (
        "Format your response like an expert academic tutor:\n"
        "- Use **bold** for key terms and concept names.\n"
        "- Present any formula in clear mathematical notation "
        "(e.g. F = ma, E = mc², ∫f(x)dx, σ = F/A).\n"
        "- Show derivation steps as numbered lists when applicable.\n"
        "- Use Markdown tables for comparisons, truth tables, or multicolumn data.\n"
        "- Cite the source document title or page when the answer is drawn from context.\n"
    )
    if stream:
        _ACADEMIC_INSTRUCT = f"[Academic stream: {stream}]\n" + _ACADEMIC_INSTRUCT

    # Privacy mode: always run locally regardless of internet / api keys
    if _privacy_mode:
        if llm._mode not in ("ollama", "onnx"):
            try:
                llm.switch_to_local()
                logger.info("Privacy mode: switched LLM to local")
            except Exception as exc:
                logger.warning("Privacy mode: could not switch to local", error=str(exc))
        answer = await llm.agenerate(
            query=query, context=context or None, history=history, max_new_tokens=1024
        )
        return answer, f"local ({llm._mode}) · private"

    # Online path: use task classifier to decide routing
    route = classify_query(query)

    if route == "cloud" and llm._mode in ("gemini", "groq"):
        if context and context.strip():
            grounded_query = (
                f"{_ACADEMIC_INSTRUCT}\n"
                f"Course material and notes (retrieved from user's knowledge base):\n"
                f"{context}\n\n"
                f"Using the above materials as the primary reference, answer the "
                f"following question thoroughly. Include relevant formulas, derivations, "
                f"or tables where they improve clarity:\n\n{query}"
            )
        else:
            grounded_query = f"{_ACADEMIC_INSTRUCT}\n{query}"

        answer = await llm.agenerate(
            query=grounded_query, context=None, history=history, max_new_tokens=1024
        )
        label = f"hybrid ({llm._mode} + local RAG)" if context else f"cloud ({llm._mode})"
        return answer, label

    # Local path (or cloud LLM not available)
    answer = await llm.agenerate(
        query=query, context=context or None, history=history, max_new_tokens=1024
    )
    return answer, f"local ({llm._mode})"

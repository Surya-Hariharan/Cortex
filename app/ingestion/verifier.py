"""Content verification agent for ingested academic documents.

Runs lightweight heuristic checks on extracted text to ensure quality
before embeddings are generated and stored.  No LLM calls are made —
this runs synchronously inside the ingestion background task.

Interface
---------
verify_content(text, stream, filename) -> VerificationResult

The ingestion pipeline uses the result to:
  - Skip embedding documents that are clearly unreadable (is_valid=False)
  - Log quality warnings without blocking upload (warnings list)
  - Tag OCR-quality issues for potential re-processing
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from app.core.logging import get_logger

logger = get_logger(__name__)

# ── Stream keyword index ──────────────────────────────────────────────────────
# Used to check whether the extracted text is plausibly related to the
# declared academic stream.  Low match count → warning only, not blocked.

_STREAM_KEYWORDS: dict[str, list[str]] = {
    "AI & ML": [
        "neural", "machine learning", "algorithm", "model", "training",
        "accuracy", "classification", "regression", "deep learning", "dataset",
        "feature", "gradient", "epoch", "backpropagation", "inference",
        "loss function", "overfitting", "embedding", "transformer", "attention",
    ],
    "Computer Science": [
        "algorithm", "complexity", "data structure", "function", "variable",
        "array", "stack", "queue", "tree", "graph", "sorting", "recursion",
        "pointer", "memory", "operating system", "process", "thread", "database",
        "sql", "network", "protocol",
    ],
    "Mechanical": [
        "stress", "strain", "force", "torque", "thermodynamics", "heat transfer",
        "fluid", "pressure", "velocity", "acceleration", "moment", "inertia",
        "vibration", "fatigue", "beam", "column", "mechanism", "gear",
    ],
    "Electronics": [
        "circuit", "voltage", "current", "resistance", "transistor", "amplifier",
        "frequency", "signal", "diode", "capacitor", "inductor", "filter",
        "digital", "analog", "microcontroller", "logic", "flip-flop", "oscillator",
    ],
    "Civil": [
        "structure", "concrete", "steel", "load", "beam", "foundation", "soil",
        "surveying", "hydraulics", "drainage", "reinforcement", "deflection",
        "shear", "bending", "compressive", "tensile", "settlement",
    ],
}

# Regex patterns for academic content indicators
_FORMULA_PATTERN = re.compile(
    r'[A-Za-z]\s*=\s*[\w\s\+\-\*/\^]+|'    # simple equation: F = ma
    r'\d+\s*[+\-*/]\s*\d+|'                  # arithmetic expression
    r'∫|∑|∂|√|π|θ|λ|σ|μ|α|β|γ|δ|Δ|∞',         # math symbols
)
_TABLE_PATTERN = re.compile(r'(\|.+\||\t.+\t)', re.MULTILINE)


@dataclass
class VerificationResult:
    is_valid: bool
    reason: str
    warnings: list[str] = field(default_factory=list)
    has_formulas: bool = False
    has_tables: bool = False
    stream_keyword_hits: int = 0
    quality_score: float = 0.0   # 0.0 – 1.0


def verify_content(
    text: str,
    stream: Optional[str] = None,
    filename: str = "",
) -> VerificationResult:
    """Run all quality checks and return a VerificationResult.

    Blocking conditions (is_valid=False):
      - Fewer than 50 characters after stripping whitespace
      - Fewer than 8 distinct words
      - Less than 60% printable characters (OCR garbage)

    Non-blocking warnings:
      - Low stream-keyword density
      - Very short content (< 200 chars)
      - No recognisable academic structure
    """
    warnings: list[str] = []
    stripped = text.strip()

    # ── Hard blocks ──────────────────────────────────────────────────────────
    if len(stripped) < 50:
        return VerificationResult(
            is_valid=False,
            reason=f"Content too short ({len(stripped)} chars) — document may be empty or image-only",
        )

    words = stripped.split()
    if len(set(words)) < 8:
        return VerificationResult(
            is_valid=False,
            reason=f"Too few unique words ({len(set(words))}) — likely OCR garbage or blank scan",
        )

    printable_ratio = sum(c.isprintable() for c in stripped) / max(len(stripped), 1)
    if printable_ratio < 0.60:
        return VerificationResult(
            is_valid=False,
            reason=f"Too many non-printable characters (printable ratio: {printable_ratio:.0%}) — OCR may have failed",
        )

    # ── Soft warnings ────────────────────────────────────────────────────────
    if len(stripped) < 200:
        warnings.append(f"Short content ({len(stripped)} chars) — embeddings may have low recall")

    # Repetition check: if >40% of lines are identical the doc is degenerate
    lines = [l.strip() for l in stripped.splitlines() if l.strip()]
    if lines:
        most_common_line_fraction = max(lines.count(l) for l in set(lines)) / len(lines)
        if most_common_line_fraction > 0.40:
            warnings.append("High line repetition detected — may be a watermarked/header-heavy scan")

    # ── Academic quality indicators ──────────────────────────────────────────
    has_formulas = bool(_FORMULA_PATTERN.search(stripped))
    has_tables = bool(_TABLE_PATTERN.search(stripped))

    # Stream keyword density
    stream_hits = 0
    if stream and stream in _STREAM_KEYWORDS:
        text_lower = stripped.lower()
        stream_hits = sum(1 for kw in _STREAM_KEYWORDS[stream] if kw in text_lower)
        if stream_hits == 0:
            warnings.append(
                f"No keywords from stream '{stream}' found — content may be misclassified"
            )
        elif stream_hits < 3:
            warnings.append(
                f"Low stream-keyword count ({stream_hits}) for '{stream}' — verify subject alignment"
            )

    # ── Quality score ────────────────────────────────────────────────────────
    score_parts = [
        min(len(words) / 200, 1.0),           # word count (saturates at 200 words)
        printable_ratio,                        # text cleanliness
        min(stream_hits / 5, 1.0),             # stream relevance (saturates at 5 hits)
        0.1 if has_formulas else 0.0,           # bonus for formulas
        0.1 if has_tables else 0.0,             # bonus for tables
    ]
    quality_score = sum(score_parts) / len(score_parts)

    if warnings:
        logger.warning(
            "Content verification warnings",
            filename=filename,
            stream=stream,
            warnings=warnings,
            quality_score=f"{quality_score:.2f}",
        )
    else:
        logger.info(
            "Content verification passed",
            filename=filename,
            stream=stream,
            words=len(words),
            formulas=has_formulas,
            tables=has_tables,
            stream_hits=stream_hits,
            quality_score=f"{quality_score:.2f}",
        )

    return VerificationResult(
        is_valid=True,
        reason="ok",
        warnings=warnings,
        has_formulas=has_formulas,
        has_tables=has_tables,
        stream_keyword_hits=stream_hits,
        quality_score=quality_score,
    )

"""PDF text extractor using PyMuPDF (fitz).

Returns per-page text content with page numbers.

Usage::

    from app.ingestion.pdf_extractor import extract_pdf
    pages = extract_pdf("/path/to/file.pdf")
    # pages = [{"page": 1, "text": "..."}, ...]
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from app.core.logging import get_logger

logger = get_logger(__name__)


def extract_pdf(file_path: str) -> List[dict]:
    """Extract text from a PDF file, one dict per page.

    Returns:
        List of {"page": int, "text": str} dicts (1-indexed).
    """
    try:
        import fitz  # type: ignore  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError("Install 'PyMuPDF' (pip install PyMuPDF) to extract PDFs") from exc

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    pages: List[dict] = []
    with fitz.open(str(path)) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text")  # type: ignore
            pages.append({"page": page_num, "text": text.strip()})

    logger.debug("PDF extracted", path=file_path, pages=len(pages))
    return pages


def extract_docx(file_path: str) -> List[dict]:
    """Extract text from a .docx file (single-page representation)."""
    try:
        import docx  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Install 'python-docx' to extract DOCX files") from exc

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"DOCX not found: {file_path}")

    doc = docx.Document(str(path))
    full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return [{"page": 1, "text": full_text}]


def extract_txt(file_path: str) -> List[dict]:
    """Plain-text extraction — split into ~500-line virtual 'pages'."""
    path = Path(file_path)
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    chunk_size = 500
    pages = []
    for i in range(0, max(1, len(lines)), chunk_size):
        text = "\n".join(lines[i : i + chunk_size])
        pages.append({"page": (i // chunk_size) + 1, "text": text})
    return pages


def extract_file(file_path: str, mime_type: str = "application/pdf") -> List[dict]:
    """Dispatch extraction based on MIME type."""
    if mime_type in ("application/pdf",):
        return extract_pdf(file_path)
    if mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return extract_docx(file_path)
    return extract_txt(file_path)

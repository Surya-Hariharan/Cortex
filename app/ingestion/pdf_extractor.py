"""Document text extractor with PaddleOCR fallback for scanned files.

Extraction strategy:
  1. PyMuPDF native text extraction (fast, works on digital PDFs)
  2. If text yield is sparse (scanned/image-based PDF) → PaddleOCR
  3. python-docx for .docx files
  4. Plain UTF-8 read for .txt / other text formats

Public API::

    from app.ingestion.pdf_extractor import extract_document
    pages, ocr_applied = extract_document("/path/to/file.pdf", "application/pdf")
    # pages = [{"page": 1, "text": "...", "ocr": False}, ...]
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Tuple

import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)

# Minimum average characters per page before we consider OCR necessary.
# A fully digital page typically has 500-3000 chars; scanned pages have ~0.
_OCR_THRESHOLD_CHARS = 80


# ── Native PDF extraction (PyMuPDF) ──────────────────────────────────────────

def extract_pdf(file_path: str) -> List[dict]:
    """Extract text natively from a digital PDF using PyMuPDF.

    Returns list of ``{"page": int, "text": str, "ocr": False}``.
    """
    try:
        import fitz  # type: ignore  # PyMuPDF
    except ImportError as exc:
        raise RuntimeError("Install PyMuPDF:  pip install PyMuPDF") from exc

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"PDF not found: {file_path}")

    pages: List[dict] = []
    with fitz.open(str(path)) as doc:
        for page_num, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()  # type: ignore
            pages.append({"page": page_num, "text": text, "ocr": False})

    logger.debug("pdf.native_extracted", path=file_path, pages=len(pages))
    return pages


def _needs_ocr(pages: List[dict]) -> bool:
    """Return True when native extraction produced very little text."""
    if not pages:
        return True
    avg_chars = sum(len(p["text"]) for p in pages) / len(pages)
    return avg_chars < _OCR_THRESHOLD_CHARS


# ── PaddleOCR extraction ──────────────────────────────────────────────────────

def _render_page_to_numpy(page) -> np.ndarray:  # type: ignore[no-untyped-def]
    """Render a fitz Page to an RGB numpy array at 200 DPI."""
    import fitz  # type: ignore
    mat = fitz.Matrix(200 / 72, 200 / 72)  # 200 DPI
    pix = page.get_pixmap(matrix=mat, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
    if pix.n == 4:          # RGBA → RGB
        img = img[:, :, :3]
    return img


def _get_ocr_engine():
    """Lazy-load PaddleOCR engine (singleton pattern)."""
    if not hasattr(_get_ocr_engine, "_instance"):
        try:
            from paddleocr import PaddleOCR  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "PaddleOCR not installed. Run:\n"
                "  pip install paddlepaddle paddleocr"
            ) from exc
        # angle_cls=True handles rotated text; use_gpu=False for CPU-only
        _get_ocr_engine._instance = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            show_log=False,
            use_gpu=False,
        )
    return _get_ocr_engine._instance


def extract_pdf_ocr(file_path: str) -> List[dict]:
    """Extract text from a scanned PDF using PaddleOCR.

    Renders each page to an image at 200 DPI and runs OCR.
    Returns list of ``{"page": int, "text": str, "ocr": True}``.
    """
    try:
        import fitz  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Install PyMuPDF:  pip install PyMuPDF") from exc

    ocr = _get_ocr_engine()
    path = Path(file_path)
    pages: List[dict] = []

    with fitz.open(str(path)) as doc:
        for page_num, page in enumerate(doc, start=1):
            img = _render_page_to_numpy(page)
            result = ocr.ocr(img, cls=True)
            lines: List[str] = []
            if result and result[0]:
                for line in result[0]:
                    if line and len(line) >= 2:
                        text_info = line[1]
                        if text_info and text_info[0]:
                            lines.append(str(text_info[0]))
            pages.append({"page": page_num, "text": "\n".join(lines), "ocr": True})

    logger.info("pdf.ocr_extracted", path=file_path, pages=len(pages))
    return pages


def extract_image_ocr(file_path: str) -> List[dict]:
    """Extract text from a raw image file using PaddleOCR.
    
    Returns list of ``{"page": 1, "text": str, "ocr": True}``.
    """
    import cv2  # type: ignore
    
    ocr = _get_ocr_engine()
    path = Path(file_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {file_path}")
        
    img = cv2.imread(str(path))
    if img is None:
        raise ValueError(f"Could not load image: {file_path}")
        
    result = ocr.ocr(img, cls=True)
    lines: List[str] = []
    
    if result and result[0]:
        for line in result[0]:
            if line and len(line) >= 2:
                text_info = line[1]
                if text_info and text_info[0]:
                    lines.append(str(text_info[0]))
                    
    logger.info("image.ocr_extracted", path=file_path, length=len("\n".join(lines)))
    return [{"page": 1, "text": "\n".join(lines), "ocr": True}]


# ── Other format extractors ───────────────────────────────────────────────────

def extract_docx(file_path: str) -> List[dict]:
    """Extract text from a .docx file."""
    try:
        import docx  # type: ignore
    except ImportError as exc:
        raise RuntimeError("Install python-docx:  pip install python-docx") from exc

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"DOCX not found: {file_path}")

    doc = docx.Document(str(path))
    full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return [{"page": 1, "text": full_text, "ocr": False}]


def extract_txt(file_path: str) -> List[dict]:
    """Plain-text extraction split into virtual 500-line pages."""
    path = Path(file_path)
    lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    chunk_size = 500
    pages = []
    for i in range(0, max(1, len(lines)), chunk_size):
        text = "\n".join(lines[i : i + chunk_size])
        pages.append({"page": (i // chunk_size) + 1, "text": text, "ocr": False})
    return pages


# ── Main public API ───────────────────────────────────────────────────────────

def extract_document(file_path: str, mime_type: str = "application/pdf") -> Tuple[List[dict], bool]:
    """Extract text from any supported document type.

    For PDFs, automatically falls back to PaddleOCR when the native extraction
    yields less than ``_OCR_THRESHOLD_CHARS`` characters per page on average
    (indicating a scanned / image-based document).

    Returns:
        ``(pages, ocr_applied)`` where ``pages`` is a list of
        ``{"page": int, "text": str, "ocr": bool}`` dicts and
        ``ocr_applied`` is True if PaddleOCR was used.
    """
    if mime_type == "application/pdf":
        pages = extract_pdf(file_path)
        if _needs_ocr(pages):
            logger.info(
                "pdf.ocr_triggered",
                path=file_path,
                avg_chars=round(sum(len(p["text"]) for p in pages) / max(1, len(pages))),
            )
            try:
                pages = extract_pdf_ocr(file_path)
                return pages, True
            except Exception as exc:
                logger.warning("pdf.ocr_failed_fallback_native", error=str(exc))
                # Return whatever native extraction gave us rather than dying
                return pages, False
        return pages, False

    if mime_type.startswith("image/"):
        try:
            pages = extract_image_ocr(file_path)
            return pages, True
        except Exception as exc:
            logger.warning("image.ocr_failed", error=str(exc))
            return [{"page": 1, "text": "", "ocr": False}], False

    if mime_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
    ):
        return extract_docx(file_path), False

    return extract_txt(file_path), False


# ── Backward-compat shim for any code still calling extract_file ──────────────
def extract_file(file_path: str, mime_type: str = "application/pdf") -> List[dict]:
    """Backward-compatible wrapper — use extract_document() for new code."""
    pages, _ = extract_document(file_path, mime_type)
    return pages

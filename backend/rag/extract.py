"""Extracts plain text from an uploaded knowledge-base file (spec section 12.5's KB
tab: PDF, DOCX, TXT, MD). `rag.ingest.ingest_document` only ever sees text — this is
the one place a file format is parsed, so chunking/embedding never has to know or
care what the source file was.
"""

from __future__ import annotations

from io import BytesIO

from docx import Document
from pypdf import PdfReader

SUPPORTED_EXTENSIONS = ("pdf", "docx", "txt", "md")


class UnsupportedFileType(Exception):
    """Raised for any extension other than PDF, DOCX, TXT, or MD."""


def _extension(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def extract_text(filename: str, content: bytes) -> str:
    """Returns the file's plain-text content. Raises `UnsupportedFileType` for
    anything outside PDF/DOCX/TXT/MD, and lets a malformed file's own parse error
    propagate — the route turns both into a 400, never a silent empty document."""
    ext = _extension(filename)
    if ext == "pdf":
        reader = PdfReader(BytesIO(content))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages).strip()
    if ext == "docx":
        document = Document(BytesIO(content))
        return "\n".join(p.text for p in document.paragraphs).strip()
    if ext in ("txt", "md"):
        return content.decode("utf-8", errors="replace").strip()
    raise UnsupportedFileType(f"Unsupported file type: .{ext or filename}")

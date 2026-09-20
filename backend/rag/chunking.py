"""Splits document text into overlapping word-based chunks (spec section 12.5): about
400 words per chunk with about 50 words of overlap, so a fact near a chunk boundary
still appears whole in at least one chunk."""

from __future__ import annotations

_CHUNK_WORDS = 400
_OVERLAP_WORDS = 50


def split_into_chunks(
    text: str, *, chunk_words: int = _CHUNK_WORDS, overlap_words: int = _OVERLAP_WORDS
) -> list[str]:
    """Empty or whitespace-only text returns `[]` (empty-state rule)."""
    words = text.split()
    if not words:
        return []

    step = max(chunk_words - overlap_words, 1)
    chunks: list[str] = []
    for start in range(0, len(words), step):
        piece = words[start : start + chunk_words]
        if not piece:
            break
        chunks.append(" ".join(piece))
        if start + chunk_words >= len(words):
            break
    return chunks

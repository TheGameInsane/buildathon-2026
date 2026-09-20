"""Shared types used across agent input/output schemas (spec section 12.3)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Channel = Literal["email", "whatsapp", "call"]


class Fact(BaseModel):
    claim: str
    source_url: str


class Chunk(BaseModel):
    """A retrieved KB chunk, as `rag.retrieval.retrieve` returns it (spec section 12.5)."""

    id: str
    content: str
    source: str | None = None
    doc_type: str | None = None

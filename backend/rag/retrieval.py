"""Knowledge-base retrieval (spec section 12.5): vector similarity search scoped to one
organization and, optionally, one campaign — while still surfacing that org's org-wide
documents (`campaign_id is null`) alongside campaign-specific ones.
"""

from __future__ import annotations

from agents.types import Chunk
from ai.llm import embed
from db.connection import org_connection

_DEFAULT_LIMIT = 5
# Cosine similarity threshold (spec section 12.5: "apply a minimum similarity
# threshold; below it, treat retrieval as empty").
_MIN_SIMILARITY = 0.15


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(str(float(v)) for v in vector) + "]"


def build_query(prospect_summary: str, intent: str) -> str:
    """A short, deterministic retrieval query built from the prospect summary and
    intent (spec section 12.5) — never the whole raw research record."""
    return f"{intent}: {prospect_summary}"[:300]


def retrieve(
    org_id: str,
    query_text: str,
    *,
    doc_types: list[str],
    campaign_id: str | None = None,
    limit: int = _DEFAULT_LIMIT,
) -> list[Chunk]:
    """Empty query text or an empty `doc_types` list return `[]` without a query
    (empty-state rule); so does a query with nothing above the similarity threshold."""
    if not query_text.strip() or not doc_types:
        return []

    [query_vector] = embed([query_text])
    query_literal = _vector_literal(query_vector)

    with org_connection(org_id) as conn:
        rows = conn.execute(
            """
            select id, content, source, doc_type,
                   1 - (embedding <=> %(q)s) as similarity
            from kb_chunks
            where org_id = %(org_id)s
              and (campaign_id = %(campaign_id)s or campaign_id is null)
              and doc_type = any(%(doc_types)s)
            order by embedding <=> %(q)s
            limit %(limit)s
            """,
            {
                "q": query_literal,
                "org_id": org_id,
                "campaign_id": campaign_id,
                "doc_types": doc_types,
                "limit": limit,
            },
        ).fetchall()

    return [
        Chunk(
            id=str(row["id"]),
            content=row["content"],
            source=row["source"],
            doc_type=row["doc_type"],
        )
        for row in rows
        if row["similarity"] >= _MIN_SIMILARITY
    ]

"""Knowledge base ingestion (spec section 12.5): text in, chunked and embedded rows in
`kb_chunks` out. Runs on upload and again when a document changes; unchanged content
(same checksum, same org, same campaign) is skipped, so re-ingesting a document is
cheap and idempotent.
"""

from __future__ import annotations

import hashlib

from ai.llm import embed
from db.connection import org_connection
from db.repository import OrgScopedRepo
from rag.chunking import split_into_chunks


def _checksum(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _vector_literal(vector: list[float]) -> str:
    """pgvector's text input format: `[v1,v2,...]`."""
    return "[" + ",".join(str(float(v)) for v in vector) + "]"


def ingest_document(
    org_id: str,
    *,
    doc_type: str,
    title: str,
    content: str,
    campaign_id: str | None = None,
    source_url: str | None = None,
    created_by: str | None = None,
) -> dict:
    """Stores the document row and its chunks and returns the stored `kb_documents`
    row. If a document with the same checksum already exists for this org and campaign,
    it is returned unchanged and no new chunks are written."""
    checksum = _checksum(content)

    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)

        # `campaign_id = %s` doesn't match NULL rows in SQL, so filter on checksum
        # alone and compare campaign_id in Python (org-wide docs have campaign_id=None).
        same_checksum = repo.list("kb_documents", filters={"checksum": checksum})
        existing = next((d for d in same_checksum if d["campaign_id"] == campaign_id), None)
        if existing is not None:
            return existing

        document = repo.insert(
            "kb_documents",
            {
                "campaign_id": campaign_id,
                "doc_type": doc_type,
                "title": title,
                "source_url": source_url,
                "content": content,
                "checksum": checksum,
                "created_by": created_by,
            },
        )

        chunk_texts = split_into_chunks(content)
        if not chunk_texts:
            return document

        vectors = embed(chunk_texts)
        for index, (chunk_text, vector) in enumerate(zip(chunk_texts, vectors, strict=True)):
            repo.insert(
                "kb_chunks",
                {
                    "document_id": document["id"],
                    "campaign_id": campaign_id,
                    "doc_type": doc_type,
                    "source": source_url or title,
                    "chunk_index": index,
                    "content": chunk_text,
                    "embedding": _vector_literal(vector),
                },
            )
        return document

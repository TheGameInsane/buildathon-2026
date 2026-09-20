"""Knowledge base routes (spec sections 10 and 12.5). URL fetching isn't wired yet.
Real files (PDF, DOCX, TXT, MD) go through `POST /kb/documents/upload`, which
extracts plain text via `rag.extract` before handing off to `rag.ingest` — chunking
and embedding never see a file format, only text. `POST /kb/documents` still takes
already-extracted text directly, for callers that already have it.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel

from api.deps import RequestContext, get_ctx
from api.errors import api_error
from rag.extract import SUPPORTED_EXTENSIONS, UnsupportedFileType, extract_text
from rag.ingest import ingest_document

router = APIRouter(tags=["knowledge"])


class KbDocumentRequest(BaseModel):
    doc_type: str
    title: str
    content: str
    campaign_id: str | None = None
    source_url: str | None = None


class KbDocumentResponse(BaseModel):
    id: str
    doc_type: str
    title: str
    campaign_id: str | None
    source_url: str | None


def _to_response(row: dict) -> KbDocumentResponse:
    return KbDocumentResponse(
        id=str(row["id"]),
        doc_type=row["doc_type"],
        title=row["title"],
        campaign_id=str(row["campaign_id"]) if row.get("campaign_id") else None,
        source_url=row.get("source_url"),
    )


@router.post("/kb/documents", response_model=KbDocumentResponse, status_code=201)
def upload_document(
    body: KbDocumentRequest, ctx: RequestContext = Depends(get_ctx)
) -> KbDocumentResponse:
    if body.campaign_id is not None:
        ctx.repo.get("campaigns", body.campaign_id)  # 404s if not this org's
    doc = ingest_document(
        ctx.org_id,
        doc_type=body.doc_type,
        title=body.title,
        content=body.content,
        campaign_id=body.campaign_id,
        source_url=body.source_url,
        created_by=ctx.actor,
    )
    return _to_response(doc)


@router.post("/kb/documents/upload", response_model=KbDocumentResponse, status_code=201)
async def upload_document_file(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
    campaign_id: str | None = Form(None),
    title: str | None = Form(None),
    ctx: RequestContext = Depends(get_ctx),
) -> KbDocumentResponse:
    if campaign_id is not None:
        ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    if not file.filename:
        raise api_error(400, "invalid_file", "File has no name")

    raw = await file.read()
    try:
        content = extract_text(file.filename, raw)
    except UnsupportedFileType as exc:
        raise api_error(
            400,
            "unsupported_file_type",
            str(exc),
            {"supported": list(SUPPORTED_EXTENSIONS)},
        ) from exc
    except Exception as exc:  # a genuinely corrupt/unreadable file, not a bad extension
        raise api_error(400, "unreadable_file", f"Couldn't read {file.filename}: {exc}") from exc

    if not content:
        raise api_error(400, "empty_file", f"{file.filename} has no extractable text")

    doc = ingest_document(
        ctx.org_id,
        doc_type=doc_type,
        title=title or file.filename,
        content=content,
        campaign_id=campaign_id,
        source_url=None,
        created_by=ctx.actor,
    )
    return _to_response(doc)


@router.get("/kb/documents", response_model=list[KbDocumentResponse])
def list_documents(
    campaign_id: str | None = None, ctx: RequestContext = Depends(get_ctx)
) -> list[KbDocumentResponse]:
    filters = {"campaign_id": campaign_id} if campaign_id else {}
    rows = ctx.repo.list("kb_documents", filters=filters, order_by="created_at")
    return [_to_response(row) for row in rows]


@router.delete("/kb/documents/{document_id}", status_code=204)
def delete_document(document_id: str, ctx: RequestContext = Depends(get_ctx)) -> None:
    ctx.repo.delete("kb_documents", document_id)  # kb_chunks cascade-delete in the DB

import { apiFetch } from "@/lib/api-client"
import type { DocType, KnowledgeDocument } from "@/types/domain"

/**
 * Wired to `/kb/documents` (backend/api/kb.py). The backend accepts/returns plain text
 * `content` (no PDF/URL fetching — see docs/api_contract.md), and its response has no
 * timestamp column exposed, so `updatedAt` can't come from the server; it's set to the
 * fetch time instead of a fabricated history.
 */

interface BackendKbDocument {
  id: string
  doc_type: string
  title: string
  campaign_id: string | null
  source_url: string | null
}

function toDoc(row: BackendKbDocument): KnowledgeDocument {
  return {
    id: row.id,
    title: row.title,
    docType: row.doc_type as DocType,
    sourceUrl: row.source_url || "#",
    updatedAt: new Date().toISOString(),
  }
}

/** GET /kb/documents?campaign_id= */
export async function fetchKnowledgeDocs(campaignId: string): Promise<KnowledgeDocument[]> {
  const rows = await apiFetch<BackendKbDocument[]>(`/kb/documents?campaign_id=${encodeURIComponent(campaignId)}`)
  return rows.map(toDoc)
}

/** POST /kb/documents — chunking/embedding happens server-side via rag.ingest. */
export async function createKnowledgeDoc(
  campaignId: string,
  doc: { title: string; docType: DocType; content: string; sourceUrl?: string },
): Promise<void> {
  await apiFetch("/kb/documents", {
    method: "POST",
    body: {
      doc_type: doc.docType,
      title: doc.title,
      content: doc.content,
      campaign_id: campaignId,
      source_url: doc.sourceUrl || null,
    },
  })
}

/** POST /kb/documents/upload — PDF, DOCX, TXT, or MD. Text extraction and
 * chunking/embedding both happen server-side (rag.extract, then rag.ingest). */
export async function uploadKnowledgeDoc(
  campaignId: string,
  file: File,
  docType: DocType,
): Promise<void> {
  const form = new FormData()
  form.append("file", file)
  form.append("doc_type", docType)
  form.append("campaign_id", campaignId)
  await apiFetch("/kb/documents/upload", { method: "POST", body: form })
}

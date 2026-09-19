import { delay } from "@/api/delay"
import { addKnowledgeDoc, listKnowledgeDocs } from "@/mocks/knowledge"
import type { DocType, KnowledgeDocument } from "@/types/domain"

/** GET /campaigns/:id/knowledge */
export async function fetchKnowledgeDocs(campaignId: string): Promise<KnowledgeDocument[]> {
  await delay()
  return listKnowledgeDocs(campaignId)
}

/** POST /campaigns/:id/knowledge (ingestion/embedding happens server-side on save) */
export async function createKnowledgeDoc(
  campaignId: string,
  doc: { title: string; docType: DocType; sourceUrl: string },
): Promise<void> {
  await delay()
  addKnowledgeDoc(campaignId, doc)
}

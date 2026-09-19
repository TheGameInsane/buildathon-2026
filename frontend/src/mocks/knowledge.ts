import type { DocType, KnowledgeDocument } from "@/types/domain"

const SEED_DOCS: { title: string; docType: DocType }[] = [
  { title: "Enterprise case study: FinBank", docType: "Case study" },
  { title: "Objection handling: pricing", docType: "Objection handling" },
  { title: "Objection handling: security review", docType: "Objection handling" },
  { title: "Cold email: CTO opener", docType: "Example email" },
  { title: "ICP definition: Series A/B SaaS", docType: "ICP definition" },
  { title: "Discovery call playbook", docType: "Playbook" },
]

const store = new Map<string, KnowledgeDocument[]>()

function seedDocs(campaignId: string): KnowledgeDocument[] {
  return SEED_DOCS.map((doc, i) => ({
    id: `${campaignId}-doc${i}`,
    title: doc.title,
    docType: doc.docType,
    sourceUrl: "#",
    updatedAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
  }))
}

function getStore(campaignId: string): KnowledgeDocument[] {
  if (!store.has(campaignId)) store.set(campaignId, seedDocs(campaignId))
  return store.get(campaignId)!
}

export function listKnowledgeDocs(campaignId: string): KnowledgeDocument[] {
  return getStore(campaignId)
}

export function addKnowledgeDoc(campaignId: string, doc: { title: string; docType: DocType; sourceUrl: string }): void {
  getStore(campaignId).unshift({
    id: `${campaignId}-doc-${Date.now()}`,
    title: doc.title,
    docType: doc.docType,
    sourceUrl: doc.sourceUrl || "#",
    updatedAt: new Date().toISOString(),
  })
}

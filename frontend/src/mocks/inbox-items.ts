import type { ApprovalItem, ConflictItem, EscalationItem, InboxItem } from "@/types/domain"

let store: InboxItem[] = [
  {
    id: "appr-1",
    kind: "approval",
    prospectName: "Adaline Cho",
    company: "Loop AI",
    campaignName: "US SaaS CTO Outreach",
    timestamp: new Date(Date.now() - 2 * 60_000).toISOString(),
    channel: "email",
    draftText: "Following up on Sarvam's speech API credits: pricing depends on your monthly volume, happy to walk through tiers.",
    flaggedReason: "Mentions pricing, needs approval",
  },
  {
    id: "appr-2",
    kind: "approval",
    prospectName: "Kenji Watanabe",
    company: "Northwind",
    campaignName: "BFSI",
    timestamp: new Date(Date.now() - 40 * 60_000).toISOString(),
    channel: "whatsapp",
    draftText: "We can offer a 12-month contract with a discounted onboarding fee if signed this quarter.",
    flaggedReason: "Mentions contract terms, needs approval",
  },
  {
    id: "appr-3",
    kind: "approval",
    prospectName: "Fatima Al-Sayed",
    company: "Skyline Labs",
    campaignName: "AI Founders Outreach",
    timestamp: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    channel: "linkedin",
    draftText: "Happy to share our SOC 2 report and walk your security team through our data handling.",
    flaggedReason: "Mentions security/compliance, needs approval",
  },
  {
    id: "esc-1",
    kind: "escalation",
    prospectName: "Ravi Menon",
    company: "FinEdge",
    campaignName: "AI Founders Outreach",
    timestamp: new Date(Date.now() - 8 * 60_000).toISOString(),
    reasonText: "Prospect asked a legal question the agent isn't authorised to answer.",
  },
  {
    id: "esc-2",
    kind: "escalation",
    prospectName: "Owen Bennett",
    company: "Anchorpoint",
    campaignName: "BFSI",
    timestamp: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    reasonText: "Prospect requested a contract cancellation, escalating for human review.",
  },
  {
    id: "conf-1",
    kind: "conflict",
    prospectName: "Priyanka Rao",
    company: "Vertex Cloud",
    campaignName: "AI Founders Outreach",
    timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    campaignA: { name: "AI Founders Outreach", wants: "send email" },
    campaignB: { name: "Existing Customer Expansion", wants: "call" },
  },
]

export function listInboxItems(): InboxItem[] {
  return store
}

export function resolveApproval(id: string): void {
  store = store.filter((item) => item.id !== id)
}

export function resolveEscalation(id: string): void {
  store = store.filter((item) => item.id !== id)
}

export function resolveConflict(id: string): void {
  store = store.filter((item) => item.id !== id)
}

export function getApproval(id: string): ApprovalItem | undefined {
  const item = store.find((i) => i.id === id)
  return item?.kind === "approval" ? item : undefined
}

export function getEscalation(id: string): EscalationItem | undefined {
  const item = store.find((i) => i.id === id)
  return item?.kind === "escalation" ? item : undefined
}

export function getConflict(id: string): ConflictItem | undefined {
  const item = store.find((i) => i.id === id)
  return item?.kind === "conflict" ? item : undefined
}

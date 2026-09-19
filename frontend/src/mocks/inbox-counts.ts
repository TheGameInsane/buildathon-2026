import { listInboxItems } from "@/mocks/inbox-items"

/** Shape of GET /inbox?countsOnly=true. */
export interface InboxCounts {
  approvals: number
  escalations: number
  conflicts: number
}

export function getInboxCounts(): InboxCounts {
  const items = listInboxItems()
  return {
    approvals: items.filter((i) => i.kind === "approval" || i.kind === "prompt_approval").length,
    escalations: items.filter((i) => i.kind === "escalation").length,
    conflicts: items.filter((i) => i.kind === "conflict").length,
  }
}

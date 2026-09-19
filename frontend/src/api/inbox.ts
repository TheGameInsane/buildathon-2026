import { delay } from "@/api/delay"
import { getInboxCounts, type InboxCounts } from "@/mocks/inbox-counts"
import {
  listInboxItems,
  resolveApproval as resolveApprovalRecord,
  resolveConflict as resolveConflictRecord,
  resolveEscalation as resolveEscalationRecord,
} from "@/mocks/inbox-items"
import type { InboxItem } from "@/types/domain"

/** GET /inbox?countsOnly=true — swap the body for a real fetch when the backend exists. */
export async function fetchInboxCounts(): Promise<InboxCounts> {
  await delay(100)
  return getInboxCounts()
}

/** GET /inbox */
export async function fetchInboxItems(): Promise<InboxItem[]> {
  await delay()
  return listInboxItems()
}

export type ApprovalResolution = "approve" | "edit" | "reject"

/** POST /approvals/:id/approve|edit|reject — an edited draft re-runs the grounding check before sending. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveApprovalItem(id: string, _resolution: ApprovalResolution): Promise<void> {
  await delay()
  resolveApprovalRecord(id)
}

export type EscalationResolution = "takeOver" | "reassign" | "dismiss"

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveEscalationItem(id: string, _resolution: EscalationResolution): Promise<void> {
  await delay()
  resolveEscalationRecord(id)
}

/** POST /conflicts/:id/resolve */
export async function resolveConflictItem(id: string): Promise<void> {
  await delay()
  resolveConflictRecord(id)
}

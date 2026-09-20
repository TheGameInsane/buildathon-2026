import { apiFetch } from "@/lib/api-client"
import { getNextBestActionState } from "@/mocks/next-best-actions"
import type { Channel, NextBestActionState, ProspectProfile, TimelineEvent, TimelineEventKind } from "@/types/domain"

/**
 * `GET /prospects/:cp_id/timeline` is real (backend/api/prospects.py) and used directly.
 *
 * There's no `GET /prospects/:cp_id` profile endpoint on the backend yet, so
 * `fetchProspectProfile` is assembled from the campaign's prospect list (which does
 * carry name/company/role/fit) plus neutral defaults for everything the backend doesn't
 * expose at all (contact details, facts, suppression, assigned rep — none of those are
 * returned by any prospect route today).
 *
 * "Next Best Action" and its approve/edit/reject/skip flow are a UI-only construct with
 * no backend counterpart (the closest real thing is the Inbox's approvals, which read
 * from a different table) — left on mock data.
 */

interface BackendCampaignProspect {
  id: string
  prospect_id: string
  stage: string
  fit_verdict: string | null
  fit_score: number | null
  full_name: string | null
  company: string | null
  role: string | null
}

interface BackendTimelineItem {
  id: string
  at: string
  channel: string | null
  direction: string
  kind: string | null
  status: string | null
  reason: string | null
  held_reason: string | null
  grounded: boolean | null
  is_seeded: boolean
}

/** GET /prospects/:cpId — reuses the campaign prospect list since there's no single-row route yet. */
export async function fetchProspectProfile(campaignId: string, prospectId: string): Promise<ProspectProfile | undefined> {
  const rows = await apiFetch<BackendCampaignProspect[]>(`/campaigns/${campaignId}/prospects`)
  const row = rows.find((r) => r.id === prospectId)
  if (!row) return undefined

  const fitScore = row.fit_score ?? 0
  const fitStatus = row.fit_verdict === "fit" || row.fit_verdict === "review" || row.fit_verdict === "no_fit" ? row.fit_verdict : "review"

  return {
    id: row.id,
    name: row.full_name ?? "Unnamed prospect",
    title: row.role ?? "",
    company: row.company ?? "",
    domain: "",
    contact: { email: "", linkedinUrl: "", location: "" },
    outreach: { lastContactedAt: null, touchpointCount: 0, channelsUsed: [] },
    facts: [],
    fitVerdict: { status: fitStatus, score: fitScore, reason: row.fit_verdict ? `Fit verdict: ${row.fit_verdict}` : "" },
    suppressed: row.stage === "disqualified" || row.stage === "stopped",
    disqualifiedReason: row.stage === "disqualified" || row.stage === "stopped" ? row.fit_verdict ?? undefined : undefined,
    owningCampaignId: campaignId,
    owningCampaignName: "",
    assignedRep: "",
  }
}

const TIMELINE_KIND: Record<string, TimelineEventKind> = {
  sent: "sent",
  received: "received",
  held: "held",
  skipped: "skipped",
  escalated: "escalated",
  cancelled: "skipped",
  failed: "held",
}

function toTimelineEvent(item: BackendTimelineItem): TimelineEvent {
  const kind = TIMELINE_KIND[item.status ?? ""] ?? (item.direction === "inbound" ? "received" : "sent")
  return {
    id: item.id,
    channel: (item.channel ?? "email") as Channel,
    kind,
    preview: item.held_reason ?? item.kind ?? "",
    reasonText: item.reason ?? "",
    groundedOk: item.grounded,
    promptVersion: 1,
    timestamp: item.at,
    details: { rawOutput: "", kbChunksUsed: [], tokensIn: 0, tokensOut: 0, cost: 0 },
  }
}

/** GET /prospects/:cpId/timeline */
export async function fetchProspectTimeline(_campaignId: string, prospectId: string): Promise<TimelineEvent[]> {
  const rows = await apiFetch<BackendTimelineItem[]>(`/prospects/${prospectId}/timeline`)
  return rows.map(toTimelineEvent)
}

/** No backend concept of "Next Best Action" — see file header. */
export async function fetchNextBestActionState(campaignId: string, prospectId: string): Promise<NextBestActionState> {
  return getNextBestActionState(campaignId, prospectId)
}

/**
 * POST /approvals/:id/approve|edit|reject would be the real route, but Next Best Action
 * has no id linking it to a real approval row — mocked as a no-op that just resolves.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveNextBestAction(_kind: "approve" | "edit" | "reject" | "skip"): Promise<void> {
  // Intentionally a no-op — see file header.
}

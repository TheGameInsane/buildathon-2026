import { delay } from "@/api/delay"
import { getNextBestActionState } from "@/mocks/next-best-actions"
import { getProspectProfile } from "@/mocks/prospect-profiles"
import { getProspectTimeline } from "@/mocks/prospect-timelines"
import type { NextBestActionState, ProspectProfile, TimelineEvent } from "@/types/domain"

/** GET /prospects/:cpId */
export async function fetchProspectProfile(campaignId: string, prospectId: string): Promise<ProspectProfile | undefined> {
  await delay()
  return getProspectProfile(campaignId, prospectId)
}

/** GET /prospects/:cpId/timeline */
export async function fetchProspectTimeline(campaignId: string, prospectId: string): Promise<TimelineEvent[]> {
  await delay()
  return getProspectTimeline(campaignId, prospectId)
}

/** Next Best Action is folded into the same timeline contract. */
export async function fetchNextBestActionState(campaignId: string, prospectId: string): Promise<NextBestActionState> {
  await delay()
  return getNextBestActionState(campaignId, prospectId)
}

/**
 * POST /approvals/:id/approve|edit|reject — mocked as a no-op that just resolves.
 * `kind` isn't used by the mock, but a real backend needs it to know which action to take.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function resolveNextBestAction(_kind: "approve" | "edit" | "reject" | "skip"): Promise<void> {
  await delay()
}

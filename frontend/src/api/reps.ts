import { delay } from "@/api/delay"
import { addRep, listAssignmentsForRep, listReps, reassignCampaignRep, setRepActive } from "@/mocks/reps"
import type { RepAssignment, RepRef, RepWithAssignments } from "@/types/domain"

/** GET /reps */
export async function fetchReps(): Promise<RepRef[]> {
  await delay()
  return listReps()
}

/** GET /reps?withAssignments=true: for Settings > Reps, which needs every rep's assigned campaigns at once. */
export async function fetchRepsWithAssignments(): Promise<RepWithAssignments[]> {
  await delay()
  return listReps().map((rep) => ({ ...rep, assignments: listAssignmentsForRep(rep.id) }))
}

/** POST /reps */
export async function createRep(name: string): Promise<RepRef> {
  await delay()
  return addRep(name)
}

/** GET /reps/:id/assignments */
export async function fetchRepAssignments(repId: string): Promise<RepAssignment[]> {
  await delay()
  return listAssignmentsForRep(repId)
}

export interface OffboardRepInput {
  repId: string
  /** Per affected campaign: a replacement rep id, or null to leave unassigned. */
  reassignments: { campaignId: string; newRepId: string | null }[]
}

/** POST /reps/:id/offboard */
export async function offboardRep(input: OffboardRepInput): Promise<void> {
  await delay()
  for (const { campaignId, newRepId } of input.reassignments) {
    reassignCampaignRep(campaignId, input.repId, newRepId)
  }
  setRepActive(input.repId, false)
}

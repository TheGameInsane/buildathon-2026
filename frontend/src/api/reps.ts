/** Wired to the real backend (`backend/api/reps.py`). */
import { apiFetch } from "@/lib/api-client"
import type { RepAssignment, RepRef, RepWithAssignments } from "@/types/domain"

interface BackendAssignment {
  campaign_id: string
  campaign_name: string
  use_rep_identity: boolean
}

interface BackendRep {
  id: string
  name: string | null
  email: string | null
  timezone: string | null
  signature: string | null
  work_start: string | null // "HH:MM"
  work_end: string | null
  work_days: number[]
  daily_caps: Record<string, number>
  status: string
  assignments: BackendAssignment[]
}

function formatHour(hhmm: string | null): string | null {
  if (!hhmm) return null
  const [hStr, mStr] = hhmm.split(":")
  const hour24 = Number.parseInt(hStr, 10)
  const suffix = hour24 >= 12 ? "pm" : "am"
  const hour12 = hour24 % 12 || 12
  return mStr === "00" ? `${hour12}${suffix}` : `${hour12}:${mStr}${suffix}`
}

/** The backend stores per-channel daily caps (`{"email":30,...}`); RepRef only has one
 * number, so this shows the highest of the configured channels, or 0 if none are set
 * yet — an honest default, not an invented one (see api/campaigns.ts's toCampaign). */
function toRepRef(row: BackendRep): RepRef {
  const caps = Object.values(row.daily_caps)
  const start = formatHour(row.work_start)
  const end = formatHour(row.work_end)
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    dailyCap: caps.length ? Math.max(...caps) : 0,
    workingHours: start && end ? `${start}–${end}` : "Not set",
    active: row.status === "active",
  }
}

function toAssignment(row: BackendAssignment): RepAssignment {
  return { campaignId: row.campaign_id, campaignName: row.campaign_name }
}

/** GET /reps */
export async function fetchReps(): Promise<RepRef[]> {
  const rows = await apiFetch<BackendRep[]>("/reps")
  return rows.map(toRepRef)
}

/** GET /reps: same route as fetchReps — the backend already includes each rep's
 * assignments in one query, so no separate call is needed. */
export async function fetchRepsWithAssignments(): Promise<RepWithAssignments[]> {
  const rows = await apiFetch<BackendRep[]>("/reps")
  return rows.map((row) => ({ ...toRepRef(row), assignments: row.assignments.map(toAssignment) }))
}

/** POST /reps */
export async function createRep(name: string): Promise<RepRef> {
  const row = await apiFetch<BackendRep>("/reps", { method: "POST", body: { name } })
  return toRepRef(row)
}

/** GET /reps/:id/assignments */
export async function fetchRepAssignments(repId: string): Promise<RepAssignment[]> {
  const rows = await apiFetch<BackendAssignment[]>(`/reps/${repId}/assignments`)
  return rows.map(toAssignment)
}

export interface OffboardRepInput {
  repId: string
  /** Per affected campaign: a replacement rep id, or null to leave unassigned. */
  reassignments: { campaignId: string; newRepId: string | null }[]
}

/** POST /reps/:id/offboard */
export async function offboardRep(input: OffboardRepInput): Promise<void> {
  await apiFetch(`/reps/${input.repId}/offboard`, {
    method: "POST",
    body: {
      reassignments: input.reassignments.map((r) => ({
        campaign_id: r.campaignId,
        new_rep_id: r.newRepId,
      })),
    },
  })
}

/** POST /campaigns/:id/reps — assign an existing rep to this campaign. */
export async function assignRepToCampaignApi(campaignId: string, repId: string): Promise<void> {
  await apiFetch(`/campaigns/${campaignId}/reps`, { method: "POST", body: { rep_id: repId } })
}

/** DELETE /campaigns/:id/reps/:repId — unassign a rep from this campaign only. */
export async function unassignRepFromCampaignApi(campaignId: string, repId: string): Promise<void> {
  await apiFetch(`/campaigns/${campaignId}/reps/${repId}`, { method: "DELETE" })
}

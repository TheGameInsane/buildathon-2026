import { apiFetch } from "@/lib/api-client"
import type { KanbanProspect, ProspectStatus } from "@/types/domain"

/**
 * Wired to `GET /campaigns/:id/prospects` (backend/api/prospects.py). The backend's
 * `CampaignProspect` row is much thinner than `KanbanProspect`: it has a `stage`
 * (discovered/researched/qualified/disqualified/contacted/engaged/meeting/opportunity/
 * stopped) but no engagement score, no touch timestamps, and no discovered-at date.
 * `STAGE_MAP` below translates `stage` into the frontend's separate `status` vocabulary
 * and its 0-6 `stageIndex`; the fields the backend doesn't track (`engagementScore`,
 * `daysSinceLastTouch`, `discoveredAt`, `lastRepliedAt`, `stageEnteredAt`) default to
 * neutral values rather than invented ones.
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
  linkedin_url: string | null
}

export interface DiscoveryImportResult {
  imported: number
  skipped: number
  prospects: BackendCampaignProspect[]
}

const STAGE_MAP: Record<string, { status: ProspectStatus; stageIndex: number }> = {
  discovered: { status: "discovered", stageIndex: 0 },
  researched: { status: "discovered", stageIndex: 1 },
  qualified: { status: "discovered", stageIndex: 2 },
  disqualified: { status: "not_interested", stageIndex: 2 },
  contacted: { status: "contacted", stageIndex: 3 },
  engaged: { status: "engaged", stageIndex: 4 },
  meeting: { status: "meeting_booked", stageIndex: 5 },
  opportunity: { status: "interested", stageIndex: 6 },
  stopped: { status: "failed", stageIndex: 6 },
}

function toKanbanProspect(row: BackendCampaignProspect): KanbanProspect {
  const mapped = STAGE_MAP[row.stage] ?? { status: "discovered" as ProspectStatus, stageIndex: 0 }
  const now = new Date().toISOString()
  return {
    id: row.id,
    name: row.full_name ?? "Unnamed prospect",
    title: row.role ?? "",
    company: row.company ?? "",
    linkedinUrl: row.linkedin_url ?? "",
    fitScore: row.fit_score ?? 0,
    engagementScore: 0,
    status: mapped.status,
    daysSinceLastTouch: 0,
    discoveredAt: now,
    lastRepliedAt: null,
    stageIndex: mapped.stageIndex,
    stageEnteredAt: now,
  }
}

/** GET /campaigns/:id/prospects */
export async function fetchProspects(campaignId: string): Promise<KanbanProspect[]> {
  const rows = await apiFetch<BackendCampaignProspect[]>(`/campaigns/${campaignId}/prospects`)
  return rows.map(toKanbanProspect)
}

/** Ask the server to run the DronaHQ ICP discovery agent and save its results. */
export async function discoverProspects(campaignId: string): Promise<DiscoveryImportResult> {
  return apiFetch<DiscoveryImportResult>(`/campaigns/${campaignId}/prospects/discover`, {
    method: "POST",
  })
}

export interface ImportedProspectRow {
  full_name?: string
  email?: string
  phone?: string
  linkedin_url?: string
  company?: string
  domain?: string
  role?: string
  country?: string
}

/** POST /campaigns/:id/prospects/import — bulk-adds prospects parsed from an uploaded
 * CSV/JSON file (see lib/parse-prospects-file.ts), deduped by email same as discovery. */
export async function importProspects(
  campaignId: string,
  rows: ImportedProspectRow[],
): Promise<DiscoveryImportResult> {
  return apiFetch<DiscoveryImportResult>(`/campaigns/${campaignId}/prospects/import`, {
    method: "POST",
    body: rows,
  })
}

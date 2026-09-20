import { apiFetch } from "@/lib/api-client"
import { assignRepToCampaignApi } from "@/api/reps"
import type { Campaign, Status } from "@/types/domain"
import type { WizardValues } from "@/types/wizard"

/**
 * Wired to the real backend (`backend/api/campaigns.py`). `GET/POST /campaigns` and the
 * lifecycle transitions all exist there, so every function below hits them directly.
 *
 * The backend's `CampaignSummary` still has no touch count, per-channel today counts,
 * rep count or last activity timestamp (no touches/rep_campaigns rollup on this
 * endpoint) — `toCampaign` fills those with honest, clearly-labelled defaults instead
 * of inventing numbers.
 */

interface BackendCampaignSummary {
  id: string
  name: string
  description: string | null
  owner: string | null
  status: string
  fit_threshold: number
  funnel: Record<string, number>
  icp: { industry?: string; geography?: string }
  target_roles: string[]
  languages: string[]
  channels: Record<string, unknown>
  channel_policy: Record<string, unknown>
  demo_seconds_per_day: number | null
  parent_campaign_id: string | null
  variant_label: string | null
  completion_feedback: { text: string; submitted_by: string; submitted_at: string } | null
}

// Matches campaigns.py's _FUNNEL_STAGES order for the first 7 (Campaign.funnelCounts is
// fixed at 7 slots — spec's Discovered..Opportunity). `disqualified`/`stopped` aren't
// part of that fixed tuple and have no slot to go in. Exported: api/metrics.ts's funnel
// dict has the same shape and order.
export const FUNNEL_KEYS = [
  "discovered", "researched", "qualified", "contacted", "engaged", "meeting", "opportunity",
] as const // fmt: skip

function toCampaign(row: BackendCampaignSummary): Campaign {
  const funnelCounts = FUNNEL_KEYS.map((key) => row.funnel[key] ?? 0) as Campaign["funnelCounts"]
  const icpLabel =
    [row.icp.industry, row.icp.geography].filter(Boolean).join(" · ") ||
    `Fit threshold ≥ ${row.fit_threshold}`

  return {
    id: row.id,
    name: row.name,
    icp: icpLabel,
    status: (row.status === "archived" ? "completed" : row.status) as Status,
    archived: row.status === "archived",
    funnelCounts,
    // Not tracked by the backend yet (no touches rollup on this endpoint).
    touchCount: 0,
    todayByChannel: {},
    owner: row.owner ?? "",
    // Not tracked by the backend yet (no rep_campaigns rollup on this endpoint —
    // see api/reps.ts's fetchRepsWithAssignments for the real per-rep assignment list).
    repCount: 0,
    lastActivityAt: new Date().toISOString(),
    completionFeedback: row.completion_feedback
      ? {
          text: row.completion_feedback.text,
          submittedBy: row.completion_feedback.submitted_by,
          submittedAt: row.completion_feedback.submitted_at,
        }
      : undefined,
  }
}

/** GET /campaigns — archived campaigns are excluded, same as the old mock's listCampaigns(). */
export async function fetchCampaigns(): Promise<Campaign[]> {
  const rows = await apiFetch<BackendCampaignSummary[]>("/campaigns")
  return rows.filter((r) => r.status !== "archived").map(toCampaign)
}

/** POST /campaigns/:id/pause */
export async function pauseCampaign(id: string): Promise<void> {
  await apiFetch(`/campaigns/${id}/pause`, { method: "POST" })
}

/** POST /campaigns/:id/resume */
export async function resumeCampaign(id: string): Promise<void> {
  await apiFetch(`/campaigns/${id}/resume`, { method: "POST" })
}

/** POST /campaigns/:id/complete */
export async function completeCampaign(id: string): Promise<void> {
  await apiFetch(`/campaigns/${id}/complete`, { method: "POST" })
}

/** POST /campaigns/:id/archive */
export async function archiveCampaign(id: string): Promise<void> {
  await apiFetch(`/campaigns/${id}/archive`, { method: "POST" })
}

/** DELETE /campaigns/:id — also removes its prospects/touches/agent_runs/reps
 * assignments/prompt versions on the backend; nothing to do here beyond the call. */
export async function deleteCampaign(id: string): Promise<void> {
  await apiFetch(`/campaigns/${id}`, { method: "DELETE" })
}

/** POST /campaigns/:id/completion-feedback */
export async function submitCampaignCompletionFeedback(
  id: string,
  text: string,
  submittedBy: string,
): Promise<Campaign> {
  const row = await apiFetch<BackendCampaignSummary>(`/campaigns/${id}/completion-feedback`, {
    method: "POST",
    body: { text, submitted_by: submittedBy },
  })
  return toCampaign(row)
}

/** POST /campaigns/:id/duplicate */
export async function duplicateCampaign(id: string): Promise<Campaign> {
  const row = await apiFetch<BackendCampaignSummary>(`/campaigns/${id}/duplicate`, {
    method: "POST",
  })
  return toCampaign(row)
}

/**
 * POST /campaigns — always creates as Draft, then assigns every rep picked in the
 * wizard via `/campaigns/:id/reps` (backend/api/reps.py) so the real preflight's
 * `rep_assigned` check actually sees them. Per-agent prompts from the wizard still
 * aren't persisted: the wizard only collects free text for them, and
 * `/campaigns/:id/prompts/:agent/versions` expects a specific agent name and content,
 * not this shape — that part of the wizard's input is dropped rather than faked.
 */
export async function createCampaignFromWizard(values: WizardValues): Promise<Campaign> {
  const row = await apiFetch<BackendCampaignSummary>("/campaigns", {
    method: "POST",
    body: {
      name: values.name,
      description: values.description || null,
      icp: {
        industry: values.industry,
        geography: values.geography,
        company_size_range: values.companySizeRange,
        exclusion_criteria: values.exclusionCriteria,
      },
      target_roles: values.targetRoles,
      channels: {
        enabled: values.channels,
        daily_caps: values.dailyCaps,
        working_hours: values.workingHours,
        timezone: values.timezone,
      },
      channel_policy: {
        requires_approval_on_first_touch: values.requiresApprovalOnFirstTouch,
        escalate_on_pricing_or_legal: values.escalateOnPricingOrLegal,
      },
      fit_threshold: 70,
    },
  })
  await Promise.all(values.repIds.map((repId) => assignRepToCampaignApi(row.id, repId)))
  return toCampaign(row)
}

export interface PreflightCheck {
  key: string
  ok: boolean
  message: string
}

interface BackendPreflight {
  ready: boolean
  checks: PreflightCheck[]
}

/** GET /campaigns/:id/preflight — the real gate `/activate` enforces, not a client-side guess. */
export async function fetchCampaignPreflight(id: string): Promise<BackendPreflight> {
  return apiFetch<BackendPreflight>(`/campaigns/${id}/preflight`)
}

/** POST /campaigns/:id/activate. 409 `not_ready` (ApiError) carries the failing checks in
 * `details.checks`, same shape as `fetchCampaignPreflight`. */
export async function activateCampaign(id: string): Promise<void> {
  await apiFetch(`/campaigns/${id}/activate`, { method: "POST" })
}

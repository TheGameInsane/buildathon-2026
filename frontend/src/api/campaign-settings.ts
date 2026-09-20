/**
 * Wired to the real backend: targeting/channels/policy read and write through
 * `PATCH /campaigns/:id` (backend/api/campaigns.py) and reps through
 * `GET /reps` + `/campaigns/:id/reps*` (backend/api/reps.py, api/reps.ts) — there is no
 * separate "campaign settings" table, this is a view over the same campaign row Overview
 * and Settings both read.
 */
import { apiFetch } from "@/lib/api-client"
import { fetchRepsWithAssignments } from "@/api/reps"
import type { CampaignSettingsData, Channel, DemoSpeed } from "@/types/domain"

interface BackendCampaignDetail {
  id: string
  icp: {
    industry?: string
    geography?: string
    company_size_range?: string
    exclusion_criteria?: string[]
  }
  target_roles: string[]
  channels: {
    enabled?: Channel[]
    daily_caps?: Partial<Record<Channel, number>>
    working_hours?: string
    timezone?: string
  }
  channel_policy: {
    requires_approval_on_first_touch?: boolean
    escalate_on_pricing_or_legal?: boolean
    requires_approval_to_activate_prompts?: boolean
  }
  demo_seconds_per_day: number | null
}

const DEMO_SPEED_SECONDS: Record<DemoSpeed, number> = { "1h": 3600, "10min": 600, "1min": 60 }

function demoSpeedFromSeconds(seconds: number | null): DemoSpeed {
  const match = (Object.entries(DEMO_SPEED_SECONDS) as [DemoSpeed, number][]).find(
    ([, s]) => s === seconds,
  )
  // null (real time) or an unrecognised value has no slot in this 3-option picker —
  // "1h" (the slowest, closest to real time) is the least misleading fallback.
  return match?.[0] ?? "1h"
}

/** GET /campaigns/:id, reshaped into the Settings form's shape. */
export async function fetchCampaignSettings(campaignId: string): Promise<CampaignSettingsData> {
  const [campaign, allReps] = await Promise.all([
    apiFetch<BackendCampaignDetail>(`/campaigns/${campaignId}`),
    fetchRepsWithAssignments(),
  ])

  return {
    targeting: {
      industry: campaign.icp.industry ?? "",
      geography: campaign.icp.geography ?? "",
      targetRoles: campaign.target_roles,
      companySizeRange: campaign.icp.company_size_range ?? "",
      exclusionCriteria: campaign.icp.exclusion_criteria ?? [],
    },
    channels: {
      enabled: campaign.channels.enabled ?? [],
      dailyCaps: campaign.channels.daily_caps ?? {},
      workingHours: campaign.channels.working_hours ?? "",
      timezone: campaign.channels.timezone ?? "",
      requiresApprovalOnFirstTouch: campaign.channel_policy.requires_approval_on_first_touch ?? false,
      escalateOnPricingOrLegal: campaign.channel_policy.escalate_on_pricing_or_legal ?? false,
    },
    reps: allReps.filter((r) => r.assignments.some((a) => a.campaignId === campaignId)),
    demoSpeedMultiplier: demoSpeedFromSeconds(campaign.demo_seconds_per_day),
    requiresApprovalToActivatePrompts:
      campaign.channel_policy.requires_approval_to_activate_prompts ?? false,
  }
}

/** PATCH /campaigns/:id — partial update, same route Settings' targeting/channels
 * sections and the wizard's create both use. Rep assignment goes through
 * `/campaigns/:id/reps*` instead (api/reps.ts), not through this campaign row.
 *
 * `channel_policy` is a full-column replace on the backend, not a merge (like every
 * jsonb column PATCH there) — writing just one of its three flags would silently drop
 * the other two. The current Settings UI always saves `channels` and
 * `requiresApprovalToActivatePrompts` together in one call, but this fetches the
 * campaign's current policy first and merges regardless, so a future caller that sends
 * only one can't lose the other two by accident.
 */
export async function saveCampaignSettings(
  campaignId: string,
  patch: Partial<CampaignSettingsData>,
): Promise<void> {
  const body: Record<string, unknown> = {}

  if (patch.targeting) {
    body.icp = {
      industry: patch.targeting.industry,
      geography: patch.targeting.geography,
      company_size_range: patch.targeting.companySizeRange,
      exclusion_criteria: patch.targeting.exclusionCriteria,
    }
    body.target_roles = patch.targeting.targetRoles
  }
  if (patch.channels) {
    body.channels = {
      enabled: patch.channels.enabled,
      daily_caps: patch.channels.dailyCaps,
      working_hours: patch.channels.workingHours,
      timezone: patch.channels.timezone,
    }
  }
  if (patch.channels || patch.requiresApprovalToActivatePrompts !== undefined) {
    const current = await apiFetch<BackendCampaignDetail>(`/campaigns/${campaignId}`)
    body.channel_policy = {
      requires_approval_on_first_touch:
        patch.channels?.requiresApprovalOnFirstTouch ??
        current.channel_policy.requires_approval_on_first_touch ?? false,
      escalate_on_pricing_or_legal:
        patch.channels?.escalateOnPricingOrLegal ??
        current.channel_policy.escalate_on_pricing_or_legal ?? false,
      requires_approval_to_activate_prompts:
        patch.requiresApprovalToActivatePrompts ??
        current.channel_policy.requires_approval_to_activate_prompts ?? false,
    }
  }
  if (patch.demoSpeedMultiplier) {
    body.demo_seconds_per_day = DEMO_SPEED_SECONDS[patch.demoSpeedMultiplier]
  }

  if (Object.keys(body).length === 0) return
  await apiFetch(`/campaigns/${campaignId}`, { method: "PATCH", body })
}

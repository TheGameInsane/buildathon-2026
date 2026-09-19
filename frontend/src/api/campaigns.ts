import { delay } from "@/api/delay"
import {
  activateCampaign as activateCampaignRecord,
  archiveCampaign as archiveCampaignRecord,
  completeCampaign as completeCampaignRecord,
  createCampaign,
  duplicateCampaign as duplicateCampaignRecord,
  getCampaign,
  listCampaigns,
  setCampaignStatus,
} from "@/mocks/campaigns"
import { seedCampaignSettings } from "@/mocks/campaign-settings"
import { listReps } from "@/mocks/reps"
import { seedPromptsFromWizard } from "@/mocks/prompts"
import type { AgentName, Campaign } from "@/types/domain"
import type { WizardValues } from "@/types/wizard"

/** GET /campaigns — swap the body for a real fetch when the backend exists. */
export async function fetchCampaigns(): Promise<Campaign[]> {
  await delay()
  return listCampaigns()
}

/** POST /campaigns/:id/pause */
export async function pauseCampaign(id: string): Promise<void> {
  await delay()
  if (!getCampaign(id)) throw new Error(`Campaign ${id} not found`)
  setCampaignStatus(id, "paused")
}

/** POST /campaigns/:id/resume */
export async function resumeCampaign(id: string): Promise<void> {
  await delay()
  if (!getCampaign(id)) throw new Error(`Campaign ${id} not found`)
  setCampaignStatus(id, "live")
}

/** POST /campaigns/:id/complete */
export async function completeCampaign(id: string): Promise<void> {
  await delay()
  completeCampaignRecord(id)
}

/** POST /campaigns/:id/archive */
export async function archiveCampaign(id: string): Promise<void> {
  await delay()
  archiveCampaignRecord(id)
}

/** POST /campaigns/:id/duplicate */
export async function duplicateCampaign(id: string): Promise<Campaign> {
  await delay()
  const copy = duplicateCampaignRecord(id)
  if (!copy) throw new Error(`Campaign ${id} not found`)
  return copy
}

/** POST /campaigns — always creates as Draft (Flow 1). Bundles the settings + prompts a real backend would write transactionally. */
export async function createCampaignFromWizard(values: WizardValues): Promise<Campaign> {
  await delay()
  const campaign = createCampaign({
    name: values.name,
    icp: `${values.industry} · ${values.geography}`,
    owner: values.owner,
    repCount: values.repIds.length,
  })

  const allReps = listReps()
  seedCampaignSettings(campaign.id, {
    targeting: {
      industry: values.industry,
      geography: values.geography,
      targetRoles: values.targetRoles,
      companySizeRange: values.companySizeRange,
      exclusionCriteria: values.exclusionCriteria,
    },
    channels: {
      enabled: values.channels,
      dailyCaps: values.dailyCaps,
      workingHours: values.workingHours,
      timezone: values.timezone,
      requiresApprovalOnFirstTouch: values.requiresApprovalOnFirstTouch,
      escalateOnPricingOrLegal: values.escalateOnPricingOrLegal,
    },
    reps: allReps.filter((rep) => values.repIds.includes(rep.id)),
    demoSpeedMultiplier: "10min",
  })

  seedPromptsFromWizard(campaign.id, values.owner, values.agentPrompts as Record<AgentName, string>)

  return campaign
}

/** POST /campaigns/:id/activate */
export async function activateCampaign(id: string): Promise<void> {
  await delay()
  activateCampaignRecord(id)
}

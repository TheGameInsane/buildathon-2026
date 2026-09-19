import { FUNNEL_STAGES } from "@/types/domain"
import type { CampaignSettingsData, StageConfig } from "@/types/domain"

const store = new Map<string, CampaignSettingsData>()

/** Manager-defined defaults, one per FUNNEL_STAGES index. Only a couple carry an action window, matching the request's example. */
export function defaultStageConfigs(): StageConfig[] {
  const configs: Record<string, Partial<StageConfig>> = {
    Qualified: { entryCriteria: "fit_score >= 70", exitCriteria: "touches_count >= 1", actionWindowHours: 24 },
    Contacted: { entryCriteria: "touches_count >= 1", exitCriteria: "engagement_score >= 30" },
    Engaged: {
      entryCriteria: "engagement_score >= 30",
      exitCriteria: "meeting_booked == true",
      actionWindowHours: 48,
    },
  }
  return FUNNEL_STAGES.map((stage) => ({
    stage,
    entryCriteria: configs[stage]?.entryCriteria ?? "",
    exitCriteria: configs[stage]?.exitCriteria ?? "",
    actionWindowHours: configs[stage]?.actionWindowHours,
  }))
}

function seedSettings(): CampaignSettingsData {
  return {
    targeting: {
      industry: "SaaS",
      geography: "United States",
      targetRoles: ["CTO", "VP Engineering"],
      companySizeRange: "50–500 employees",
      exclusionCriteria: ["Existing customers", "Competitors"],
    },
    channels: {
      enabled: ["email", "whatsapp", "linkedin"],
      dailyCaps: { email: 50, whatsapp: 20, linkedin: 10 },
      workingHours: "9am–6pm",
      timezone: "America/New_York",
      requiresApprovalOnFirstTouch: true,
      escalateOnPricingOrLegal: true,
    },
    reps: [
      { id: "rep-1", name: "Priya Sharma", email: "priya@company.com", dailyCap: 60, workingHours: "9am–6pm", active: true },
      { id: "rep-2", name: "Dev Patel", email: "dev@company.com", dailyCap: 50, workingHours: "9am–6pm", active: true },
    ],
    demoSpeedMultiplier: "10min",
    stages: defaultStageConfigs(),
    requiresApprovalToActivatePrompts: false,
  }
}

function getStore(campaignId: string): CampaignSettingsData {
  if (!store.has(campaignId)) store.set(campaignId, seedSettings())
  return store.get(campaignId)!
}

export function getCampaignSettings(campaignId: string): CampaignSettingsData {
  return getStore(campaignId)
}

export function updateCampaignSettings(campaignId: string, patch: Partial<CampaignSettingsData>): void {
  store.set(campaignId, { ...getStore(campaignId), ...patch })
}

/** Seeds settings straight from the New Campaign Wizard instead of the generic defaults. */
export function seedCampaignSettings(campaignId: string, settings: CampaignSettingsData): void {
  store.set(campaignId, settings)
}

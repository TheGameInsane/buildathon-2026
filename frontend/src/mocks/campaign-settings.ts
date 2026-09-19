import type { CampaignSettingsData } from "@/types/domain"

const store = new Map<string, CampaignSettingsData>()

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

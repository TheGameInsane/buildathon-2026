import type { Campaign } from "@/types/domain"

/**
 * In-memory stand-in for the campaigns table. src/api/campaigns.ts wraps this
 * with simulated network delay: swap that file for real `fetch` calls later
 * without touching any component. `funnelCounts` is the only source of truth
 * for prospect/meeting numbers, see src/lib/campaign-metrics.ts.
 */
const store: Campaign[] = [
  {
    id: "bfsi",
    name: "BFSI",
    icp: "Banking CXOs · India",
    status: "live",
    funnelCounts: [980, 860, 512, 340, 160, 22, 9],
    touchCount: 340,
    todayByChannel: { email: 6, linkedin: 2 },
    sparkline: [3, 5, 4, 6, 8, 7, 9],
    owner: "Priya",
    repCount: 3,
    lastActivityAt: new Date(Date.now() - 14_000).toISOString(),
  },
  {
    id: "ai-founders-outreach",
    name: "AI Founders Outreach",
    icp: "Founder/CTO · AI startups",
    status: "live",
    funnelCounts: [640, 590, 380, 210, 95, 11, 4],
    touchCount: 210,
    todayByChannel: { email: 4, linkedin: 5 },
    sparkline: [2, 3, 3, 5, 6, 8, 10],
    owner: "Priya",
    repCount: 2,
    lastActivityAt: new Date(Date.now() - 41_000).toISOString(),
  },
  {
    id: "us-saas-cto",
    name: "US SaaS CTO Outreach",
    icp: "SaaS CTO · US",
    status: "paused",
    funnelCounts: [1284, 1180, 640, 426, 198, 18, 6],
    touchCount: 426,
    todayByChannel: { email: 8, whatsapp: 3, linkedin: 2 },
    sparkline: [4, 6, 5, 8, 7, 10, 12],
    owner: "Priya",
    repCount: 3,
    lastActivityAt: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  },
  {
    id: "existing-customer-expansion",
    name: "Existing Customer Expansion",
    icp: "Existing customers · upsell",
    status: "draft",
    funnelCounts: [0, 0, 0, 0, 0, 0, 0],
    touchCount: 0,
    todayByChannel: {},
    sparkline: [0, 0, 0, 0, 0, 0, 0],
    owner: "Priya",
    repCount: 0,
    lastActivityAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  },
]

/** Mission Control only shows active (non-archived) campaigns. */
export function listCampaigns(): Campaign[] {
  return store.filter((c) => !c.archived)
}

export function getCampaign(id: string): Campaign | undefined {
  return store.find((c) => c.id === id)
}

export function setCampaignStatus(id: string, status: "live" | "paused"): void {
  const campaign = store.find((c) => c.id === id)
  if (campaign) {
    campaign.status = status
    campaign.lastActivityAt = new Date().toISOString()
  }
}

export function completeCampaign(id: string): void {
  const campaign = store.find((c) => c.id === id)
  if (campaign) {
    campaign.status = "completed"
    campaign.lastActivityAt = new Date().toISOString()
  }
}

export function archiveCampaign(id: string): void {
  const campaign = store.find((c) => c.id === id)
  if (campaign) campaign.archived = true
}

export interface NewCampaignInput {
  name: string
  icp: string
  owner: string
  repCount: number
}

export function createCampaign(input: NewCampaignInput): Campaign {
  const campaign: Campaign = {
    id: `campaign-${Date.now()}`,
    name: input.name,
    icp: input.icp,
    status: "draft",
    funnelCounts: [0, 0, 0, 0, 0, 0, 0],
    touchCount: 0,
    todayByChannel: {},
    sparkline: [0, 0, 0, 0, 0, 0, 0],
    owner: input.owner,
    repCount: input.repCount,
    lastActivityAt: new Date().toISOString(),
  }
  store.push(campaign)
  return campaign
}

/** POST /campaigns/:id/activate */
export function activateCampaign(id: string): void {
  setCampaignStatus(id, "live")
}

export function duplicateCampaign(id: string): Campaign | undefined {
  const source = store.find((c) => c.id === id)
  if (!source) return undefined
  const copy: Campaign = {
    ...source,
    id: `${source.id}-copy-${Date.now()}`,
    name: `${source.name} (Copy)`,
    status: "draft",
    archived: false,
    touchCount: 0,
    todayByChannel: {},
    funnelCounts: [0, 0, 0, 0, 0, 0, 0],
    sparkline: [0, 0, 0, 0, 0, 0, 0],
    lastActivityAt: new Date().toISOString(),
  }
  store.push(copy)
  return copy
}

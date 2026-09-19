import { activatePromptVersion } from "@/mocks/prompts"
import { getCampaignSettings } from "@/mocks/campaign-settings"
import { listCampaigns } from "@/mocks/campaigns"
import { listProspects } from "@/mocks/prospects"
import { FUNNEL_STAGES } from "@/types/domain"
import type { AgentName, ApprovalItem, ConflictItem, EscalationItem, InboxItem, PromptApprovalItem } from "@/types/domain"

let store: InboxItem[] = [
  {
    id: "appr-1",
    kind: "approval",
    prospectName: "Adaline Cho",
    company: "Loop AI",
    campaignName: "US SaaS CTO Outreach",
    campaignId: "us-saas-cto",
    prospectId: "us-saas-cto-p4",
    timestamp: new Date(Date.now() - 2 * 60_000).toISOString(),
    channel: "email",
    draftText: "Following up on Sarvam's speech API credits: pricing depends on your monthly volume, happy to walk through tiers.",
    flaggedReason: "Mentions pricing, needs approval",
  },
  {
    id: "appr-2",
    kind: "approval",
    prospectName: "Kenji Watanabe",
    company: "Northwind",
    campaignName: "BFSI",
    campaignId: "bfsi",
    prospectId: "bfsi-p9",
    timestamp: new Date(Date.now() - 40 * 60_000).toISOString(),
    channel: "whatsapp",
    draftText: "We can offer a 12-month contract with a discounted onboarding fee if signed this quarter.",
    flaggedReason: "Mentions contract terms, needs approval",
  },
  {
    id: "appr-3",
    kind: "approval",
    prospectName: "Fatima Al-Sayed",
    company: "Skyline Labs",
    campaignName: "AI Founders Outreach",
    campaignId: "ai-founders-outreach",
    prospectId: "ai-founders-outreach-p7",
    timestamp: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    channel: "linkedin",
    draftText: "Happy to share our SOC 2 report and walk your security team through our data handling.",
    flaggedReason: "Mentions security/compliance, needs approval",
  },
  {
    id: "esc-1",
    kind: "escalation",
    prospectName: "Ravi Menon",
    company: "FinEdge",
    campaignName: "AI Founders Outreach",
    campaignId: "ai-founders-outreach",
    prospectId: "ai-founders-outreach-p2",
    timestamp: new Date(Date.now() - 8 * 60_000).toISOString(),
    reasonText: "Prospect asked a legal question the agent isn't authorised to answer.",
  },
  {
    id: "esc-2",
    kind: "escalation",
    prospectName: "Owen Bennett",
    company: "Anchorpoint",
    campaignName: "BFSI",
    campaignId: "bfsi",
    prospectId: "bfsi-p8",
    timestamp: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    reasonText: "Prospect requested a contract cancellation, escalating for human review.",
  },
  {
    id: "conf-1",
    kind: "conflict",
    prospectName: "Priyanka Rao",
    company: "Vertex Cloud",
    campaignName: "AI Founders Outreach",
    campaignId: "ai-founders-outreach",
    prospectId: "ai-founders-outreach-p10",
    timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
    campaignA: { name: "AI Founders Outreach", wants: "send email" },
    campaignB: { name: "Existing Customer Expansion", wants: "call" },
  },
]

/** Escalations already dismissed once shouldn't reappear just because the window is still expired. */
const dismissedActionWindowEscalations = new Set<string>()

/** Fires an Inbox escalation for any prospect whose stage action window lapsed with no action taken. */
function syncActionWindowEscalations(): void {
  for (const campaign of listCampaigns()) {
    const settings = getCampaignSettings(campaign.id)
    for (const prospect of listProspects(campaign.id)) {
      const stageConfig = settings.stages[prospect.stageIndex]
      if (!stageConfig?.actionWindowHours) continue

      const deadline = new Date(prospect.stageEnteredAt).getTime() + stageConfig.actionWindowHours * 3_600_000
      if (Date.now() < deadline) continue

      const id = `esc-aw-${campaign.id}-${prospect.id}`
      if (dismissedActionWindowEscalations.has(id) || store.some((item) => item.id === id)) continue

      store.push({
        id,
        kind: "escalation",
        prospectName: prospect.name,
        company: prospect.company,
        campaignName: campaign.name,
        campaignId: campaign.id,
        prospectId: prospect.id,
        timestamp: new Date(deadline).toISOString(),
        reasonText: `Action window for "${FUNNEL_STAGES[prospect.stageIndex]}" (${stageConfig.actionWindowHours}h) expired with no action taken.`,
      })
    }
  }
}

export function listInboxItems(): InboxItem[] {
  syncActionWindowEscalations()
  return store
}

export function resolveApproval(id: string): void {
  store = store.filter((item) => item.id !== id)
}

export function resolveEscalation(id: string): void {
  if (id.startsWith("esc-aw-")) dismissedActionWindowEscalations.add(id)
  store = store.filter((item) => item.id !== id)
}

export function resolveConflict(id: string): void {
  store = store.filter((item) => item.id !== id)
}

export function getApproval(id: string): ApprovalItem | undefined {
  const item = store.find((i) => i.id === id)
  return item?.kind === "approval" ? item : undefined
}

export function getEscalation(id: string): EscalationItem | undefined {
  const item = store.find((i) => i.id === id)
  return item?.kind === "escalation" ? item : undefined
}

export function getConflict(id: string): ConflictItem | undefined {
  const item = store.find((i) => i.id === id)
  return item?.kind === "conflict" ? item : undefined
}

/** Campaign Settings' "requires approval to activate prompts" toggle routes activation here instead. */
export function addPromptApprovalItem(input: {
  campaignId: string
  campaignName: string
  agentName: AgentName
  version: number
  requestedBy: string
}): PromptApprovalItem {
  const item: PromptApprovalItem = {
    id: `prompt-appr-${input.campaignId}-${input.agentName}-${input.version}-${Date.now()}`,
    kind: "prompt_approval",
    timestamp: new Date().toISOString(),
    ...input,
  }
  store.push(item)
  return item
}

/** Approve activates the version for real; reject just drops the request. */
export function resolvePromptApproval(id: string, resolution: "approve" | "reject"): void {
  const item = store.find((i) => i.id === id)
  if (item?.kind === "prompt_approval" && resolution === "approve") {
    activatePromptVersion(item.campaignId, item.agentName, item.version)
  }
  store = store.filter((i) => i.id !== id)
}

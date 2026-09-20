import { getCampaign } from "@/mocks/campaigns"
import { listProspects } from "@/mocks/prospects"
import type { Channel, FitVerdictStatus, ProspectProfile } from "@/types/domain"

const REP_NAMES = ["Priya Sharma", "Dev Patel"]
const LOCATIONS = ["San Francisco, CA", "New York, NY", "Austin, TX", "London, UK", "Bengaluru, India", "Toronto, Canada"]

function verdictForScore(score: number): { status: FitVerdictStatus; reason: string } {
  if (score >= 80) return { status: "fit", reason: "Matches ICP on size, industry, and stated tech stack." }
  if (score >= 50) return { status: "review", reason: "Partial ICP match: company size is slightly below range." }
  return { status: "no_fit", reason: "Outside target industry and company size range." }
}

const store = new Map<string, ProspectProfile>()

function buildProfile(campaignId: string, prospectId: string): ProspectProfile | undefined {
  const kanban = listProspects(campaignId).find((p) => p.id === prospectId)
  const campaign = getCampaign(campaignId)
  if (!kanban || !campaign) return undefined

  const n = Number(prospectId.split("-p")[1] ?? 0)
  const suppressed = n % 7 === 0
  const disqualified = !suppressed && n % 11 === 0
  const hasConflict = !suppressed && !disqualified && n % 5 === 0

  const verdict = disqualified ? { status: "no_fit" as const, reason: verdictForScore(20).reason } : verdictForScore(kanban.fitScore)

  const firstName = kanban.name.split(" ")[0].toLowerCase()
  const lastName = kanban.name.split(" ").slice(-1)[0].toLowerCase()
  const domain = `${kanban.company.toLowerCase().replace(/\s+/g, "")}.com`

  const channelsUsed: Channel[] = ["email"]
  if (kanban.stageIndex >= 2) channelsUsed.push("whatsapp")

  return {
    id: kanban.id,
    name: kanban.name,
    title: kanban.title,
    company: kanban.company,
    domain,
    contact: {
      email: `${firstName}.${lastName}@${domain}`,
      phone: n % 2 === 0 ? `+1 555 0${100 + (n % 900)}` : undefined,
      whatsapp: n % 3 === 0 ? `+1 555 0${100 + (n % 900)}` : undefined,
      linkedinUrl: kanban.linkedinUrl,
      location: LOCATIONS[n % LOCATIONS.length],
    },
    outreach: {
      lastContactedAt: kanban.lastRepliedAt ?? (kanban.stageIndex > 0 ? new Date(Date.now() - kanban.daysSinceLastTouch * 86_400_000).toISOString() : null),
      touchpointCount: Math.max(1, kanban.stageIndex * 2 + (n % 3)),
      channelsUsed,
    },
    facts: [
      { text: `${kanban.company} raised a Series ${n % 2 === 0 ? "A" : "B"} in the last 12 months.`, sourceUrl: "#" },
      { text: `Builds on ${n % 2 === 0 ? "AWS" : "GCP"}, evaluating LLM infra vendors.`, sourceUrl: "#" },
      { text: `${kanban.name} posted about scaling support ops last month.`, sourceUrl: "#" },
    ],
    fitVerdict: { status: disqualified ? "no_fit" : verdict.status, score: disqualified ? 20 : kanban.fitScore, reason: verdict.reason },
    otherCampaignName: hasConflict ? "Existing Customer Expansion" : undefined,
    suppressed,
    disqualifiedReason: disqualified ? "Company size fell below the campaign's minimum threshold." : undefined,
    owningCampaignId: campaign.id,
    owningCampaignName: campaign.name,
    assignedRep: REP_NAMES[n % REP_NAMES.length],
  }
}

export function getProspectProfile(campaignId: string, prospectId: string): ProspectProfile | undefined {
  const key = `${campaignId}:${prospectId}`
  if (!store.has(key)) {
    const profile = buildProfile(campaignId, prospectId)
    if (!profile) return undefined
    store.set(key, profile)
  }
  return store.get(key)
}

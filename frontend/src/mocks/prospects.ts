import type { Channel, KanbanProspect, ProspectStatus } from "@/types/domain"

const NAMES = [
  "Adaline Cho",
  "Ravi Menon",
  "Sofia Reyes",
  "Kenji Watanabe",
  "Priyanka Rao",
  "Lucas Meyer",
  "Fatima Al-Sayed",
  "Owen Bennett",
  "Ines Duarte",
  "Arjun Nair",
]
const COMPANIES = ["Loop AI", "FinEdge", "Northwind", "Skyline Labs", "Vertex Cloud", "Anchorpoint", "Brightline"]
const TITLES = ["CTO", "VP Engineering", "Head of Growth", "Founder"]
const CHANNELS: Channel[] = ["email", "whatsapp", "linkedin"]

const store = new Map<string, KanbanProspect[]>()

/** A handful of prospects land in terminal states regardless of funnel stage, so every status filter has real data. */
function deriveStatus(n: number, stageIndex: number): ProspectStatus {
  if (n % 13 === 0) return "not_interested"
  if (n % 17 === 0) return "failed"
  if (n % 19 === 0) return "paused"
  if (stageIndex <= 2) return "discovered"
  if (stageIndex === 3) return "contacted"
  if (stageIndex === 4) return n % 2 === 0 ? "engaged" : "replied"
  if (stageIndex === 5) return "meeting_booked"
  return n % 3 === 0 ? "interested" : "meeting_booked"
}

function seedProspects(campaignId: string): KanbanProspect[] {
  const perStageCounts = [5, 4, 4, 3, 2, 1, 1]
  const prospects: KanbanProspect[] = []
  let n = 0
  perStageCounts.forEach((count, stageIndex) => {
    for (let i = 0; i < count; i++) {
      n += 1
      const status = deriveStatus(n, stageIndex)
      const hasReplied = status === "replied" || status === "engaged" || status === "interested" || status === "meeting_booked"

      prospects.push({
        id: `${campaignId}-p${n}`,
        name: NAMES[n % NAMES.length],
        title: TITLES[n % TITLES.length],
        company: COMPANIES[n % COMPANIES.length],
        fitScore: 55 + ((n * 7) % 45),
        engagementScore: Math.min(100, stageIndex * 12 + ((n * 5) % 40)),
        status,
        daysSinceLastTouch: n % 9,
        discoveredAt: new Date(Date.now() - ((n % 20) + stageIndex * 2) * 86_400_000).toISOString(),
        lastRepliedAt: hasReplied ? new Date(Date.now() - (n % 5) * 86_400_000).toISOString() : null,
        nextActionChannel: stageIndex < 6 ? CHANNELS[n % CHANNELS.length] : undefined,
        stageIndex,
      })
    }
  })
  return prospects
}

function getStore(campaignId: string): KanbanProspect[] {
  if (!store.has(campaignId)) store.set(campaignId, seedProspects(campaignId))
  return store.get(campaignId)!
}

export function listProspects(campaignId: string): KanbanProspect[] {
  return getStore(campaignId)
}

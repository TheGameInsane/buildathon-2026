import type { ActivityFeedEvent, AgentName, Channel } from "@/types/domain"

const TEMPLATES: {
  channel: Channel
  agentName: AgentName
  actionText: string
  campaignId: string
  campaignName: string
  reasonText: string
  promptVersion: number
  groundedOk: boolean | null
}[] = [
  {
    channel: "email",
    agentName: "Personalisation",
    actionText: "drafted an email to a CIO",
    campaignId: "ai-founders-outreach",
    campaignName: "AI Founders Outreach",
    reasonText: "Fit score 82, first touch due, and a matching case study was found in the knowledge base.",
    promptVersion: 4,
    groundedOk: true,
  },
  {
    channel: "whatsapp",
    agentName: "Conversation",
    actionText: "booked a meeting",
    campaignId: "bfsi",
    campaignName: "BFSI",
    reasonText: "Prospect confirmed a time slot after two rounds of scheduling back-and-forth.",
    promptVersion: 2,
    groundedOk: null,
  },
  {
    channel: "linkedin",
    agentName: "Outreach Strategy",
    actionText: "connection accepted",
    campaignId: "ai-founders-outreach",
    campaignName: "AI Founders Outreach",
    reasonText: "Prospect accepted the connection request queued 2 days ago.",
    promptVersion: 3,
    groundedOk: null,
  },
  {
    channel: "whatsapp",
    agentName: "Conversation",
    actionText: "classified a reply as interested",
    campaignId: "us-saas-cto",
    campaignName: "US SaaS CTO Outreach",
    reasonText: "Reply contained a pricing question and a request to see a demo, classified as interested.",
    promptVersion: 5,
    groundedOk: true,
  },
  {
    channel: "email",
    agentName: "Follow-up",
    actionText: "sent a follow-up after no reply",
    campaignId: "bfsi",
    campaignName: "BFSI",
    reasonText: "No reply after 4 days on the first touch, within the campaign's follow-up cadence.",
    promptVersion: 3,
    groundedOk: true,
  },
  {
    channel: "email",
    agentName: "Research",
    actionText: "found a new prospect matching the ICP",
    campaignId: "ai-founders-outreach",
    campaignName: "AI Founders Outreach",
    reasonText: "Title and company size matched the campaign's ICP definition; added to the Discovered stage.",
    promptVersion: 1,
    groundedOk: null,
  },
]

let seq = 0
function nextId() {
  seq += 1
  return `evt-${seq}`
}

function makeEvent(template: (typeof TEMPLATES)[number]): ActivityFeedEvent {
  return {
    id: nextId(),
    channel: template.channel,
    agentName: template.agentName,
    actionText: template.actionText,
    campaignId: template.campaignId,
    campaignName: template.campaignName,
    timestamp: new Date().toISOString(),
    prospectId: `prospect-${Math.floor(Math.random() * 50) + 1}`,
    reasonText: template.reasonText,
    promptVersion: template.promptVersion,
    groundedOk: template.groundedOk,
  }
}

let feed: ActivityFeedEvent[] = Array.from({ length: 8 }, (_, i) => {
  const event = makeEvent(TEMPLATES[i % TEMPLATES.length])
  event.timestamp = new Date(Date.now() - i * 45_000).toISOString()
  return event
})

const MAX_FEED_LENGTH = 30

/** Simulates the feed "ticking" — each poll may add 0–2 new events, feeding the "system feels alive" requirement. */
export function listActivityFeed(): ActivityFeedEvent[] {
  const newEventCount = Math.random() < 0.7 ? 1 : 0
  for (let i = 0; i < newEventCount; i++) {
    const template = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)]
    feed = [makeEvent(template), ...feed].slice(0, MAX_FEED_LENGTH)
  }
  return feed
}

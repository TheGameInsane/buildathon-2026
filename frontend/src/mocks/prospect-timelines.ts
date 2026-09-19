import { renderTemplate } from "@/lib/liquid-template-engine"
import { getProspectProfile } from "@/mocks/prospect-profiles"
import type { Channel, PersonalizationTier, TimelineEvent } from "@/types/domain"

const store = new Map<string, TimelineEvent[]>()

/** Resolved server-side, before any LLM call — so a templated LinkedIn note still feels branch-aware. */
const LINKEDIN_TEMPLATE_NOTE =
  `Hi {{ prospect.firstName }}, following up on {{ prospect.company }}'s scaling plans. ` +
  `{% if prospect.segment == "voice_ai_founder" %}Curious how you're thinking about latency for real-time voice.` +
  `{% else %}Would love to trade notes on your infra roadmap.{% endif %}`

/** Picks the tier for a prospect's first outbound touch. */
function firstTouchPersonalization(
  channel: Channel,
  n: number,
  firstName: string,
  company: string,
): { tier: PersonalizationTier; preview: string } {
  if (channel === "linkedin") {
    const segment = n % 2 === 0 ? "voice_ai_founder" : "other"
    return {
      tier: "template",
      preview: renderTemplate(LINKEDIN_TEMPLATE_NOTE, { prospect: { firstName, company, segment } }),
    }
  }

  return { tier: "ai", preview: `Following up on ${company}'s infra scaling plans…` }
}

function baseDetails(cost = 0.004): TimelineEvent["details"] {
  return {
    rawOutput: '{"action": "send", "confidence": 0.88}',
    kbChunksUsed: [{ title: "Objection handling: pricing", url: "#" }],
    tokensIn: 480,
    tokensOut: 140,
    cost,
  }
}

function buildTimeline(campaignId: string, prospectId: string): TimelineEvent[] {
  const profile = getProspectProfile(campaignId, prospectId)
  if (!profile) return []

  const channels: Channel[] = ["email", "whatsapp", "linkedin"]
  const n = Number(prospectId.split("-p")[1] ?? 0)
  const events: TimelineEvent[] = []
  let daysAgo = 6

  events.push({
    id: `${prospectId}-t1`,
    channel: "linkedin",
    kind: "received",
    preview: "Connection accepted.",
    reasonText: "",
    groundedOk: null,
    promptVersion: 1,
    timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    details: baseDetails(0),
  })
  daysAgo -= 1

  const firstTouchChannel = channels[n % channels.length]
  const firstName = profile.name.split(" ")[0]
  const firstTouch = firstTouchPersonalization(firstTouchChannel, n, firstName, profile.company)
  events.push({
    id: `${prospectId}-t2`,
    channel: firstTouchChannel,
    kind: "sent",
    preview: firstTouch.preview,
    reasonText: "Opened first email twice, no reply: trying a different angle before switching channels.",
    groundedOk: true,
    promptVersion: 3,
    timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
    details: baseDetails(),
    personalizationTier: firstTouch.tier,
  })
  daysAgo -= 2

  if (n % 3 === 0) {
    events.push({
      id: `${prospectId}-t3`,
      channel: "email",
      kind: "held",
      preview: "",
      reasonText: "Campaign paused",
      groundedOk: null,
      promptVersion: 3,
      timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      details: baseDetails(0),
    })
  } else if (n % 4 === 0) {
    events.push({
      id: `${prospectId}-t3`,
      channel: "whatsapp",
      kind: "received",
      preview: "Sure, happy to chat, send me a good time.",
      reasonText: 'Replied "let\'s find a time" to last message.',
      groundedOk: null,
      promptVersion: 2,
      timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      details: baseDetails(0.02),
    })
  } else {
    events.push({
      id: `${prospectId}-t3`,
      channel: channels[(n + 1) % channels.length],
      kind: "received",
      preview: "Sounds interesting, can you send more detail?",
      reasonText: "",
      groundedOk: null,
      promptVersion: 3,
      timestamp: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      details: baseDetails(0),
    })
  }
  daysAgo -= 1

  if (profile.fitVerdict.status !== "no_fit" && !profile.suppressed) {
    events.push({
      id: `${prospectId}-t4`,
      channel: channels[(n + 2) % channels.length],
      kind: "sent",
      preview: "Sharing a short case study relevant to your stack.",
      reasonText: "Prospect asked for more detail: following up with proof points.",
      groundedOk: true,
      promptVersion: 3,
      timestamp: new Date(Date.now() - Math.max(daysAgo, 0) * 86_400_000).toISOString(),
      details: baseDetails(),
      personalizationTier: "ai",
    })
  }

  if (profile.disqualifiedReason) {
    events.push({
      id: `${prospectId}-t-final`,
      channel: "email",
      kind: "disqualified",
      preview: "",
      reasonText: profile.disqualifiedReason,
      groundedOk: null,
      promptVersion: 2,
      timestamp: new Date().toISOString(),
      details: baseDetails(0),
    })
  }

  return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export function getProspectTimeline(campaignId: string, prospectId: string): TimelineEvent[] {
  const key = `${campaignId}:${prospectId}`
  if (!store.has(key)) store.set(key, buildTimeline(campaignId, prospectId))
  return store.get(key)!
}

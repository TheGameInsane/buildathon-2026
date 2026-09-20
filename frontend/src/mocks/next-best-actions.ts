import { getProspectProfile } from "@/mocks/prospect-profiles"
import type { Channel, NextBestActionState } from "@/types/domain"

const channels: Channel[] = ["email", "whatsapp"]

export function getNextBestActionState(campaignId: string, prospectId: string): NextBestActionState {
  const profile = getProspectProfile(campaignId, prospectId)
  if (!profile) return { kind: "none" }

  if (profile.disqualifiedReason || profile.suppressed) return { kind: "none" }

  const n = Number(prospectId.split("-p")[1] ?? 0)
  if (n % 4 === 0) return { kind: "researching" }

  const requiresApproval = n % 3 === 0
  const channel = channels[n % channels.length]
  return {
    kind: "action",
    action: {
      channel,
      when: n % 2 === 0 ? "tomorrow 10am IST" : "in 2 days",
      intent: n % 2 === 0 ? "Follow-up message" : "Follow-up email",
      reasonText:
        n % 2 === 0 ? `Replied "sounds good" to last message.` : "No reply after 5 days: sending a lighter-touch nudge.",
      draftContent: requiresApproval ? "Hi, just circling back, would love 15 minutes this week." : undefined,
      requiresApproval,
      personalizationTier: n % 2 === 0 ? "ai" : "template",
    },
  }
}

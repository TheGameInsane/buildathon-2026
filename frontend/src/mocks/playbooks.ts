import type { Playbook, PlaybookRule } from "@/types/domain"

const store = new Map<string, Playbook>()

/** Readable front-end for rules that already live in the Outreach Strategy agent's prompt/logic. */
function seedPlaybook(campaignId: string): Playbook {
  const rules: PlaybookRule[] = [
    { id: "rule-1", trigger: "Prospect opens email 2x, no reply", action: 'Move to "high-intent" cadence, escalate to voice' },
    { id: "rule-2", trigger: "No engagement after 14 days", action: "Move to long-term nurture, reduce cadence frequency" },
    { id: "rule-3", trigger: 'Prospect replies "not now"', action: "Pause cadence 90 days, no escalation" },
  ]
  return { campaignId, rules }
}

function getStore(campaignId: string): Playbook {
  if (!store.has(campaignId)) store.set(campaignId, seedPlaybook(campaignId))
  return store.get(campaignId)!
}

export function getPlaybook(campaignId: string): Playbook {
  return getStore(campaignId)
}

export function savePlaybook(campaignId: string, rules: PlaybookRule[]): void {
  store.set(campaignId, { campaignId, rules })
}

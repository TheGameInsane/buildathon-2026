import { AGENT_PIPELINE_ORDER } from "@/types/domain"
import type { AgentName, PromptVersion } from "@/types/domain"

const BASE_PROMPT = "You are Aditi, an SDR at Sarvam.\nUse ONLY facts from the knowledge base."

const store = new Map<string, Record<AgentName, PromptVersion[]>>()

function seedPromptsForCampaign(): Record<AgentName, PromptVersion[]> {
  const record = {} as Record<AgentName, PromptVersion[]>
  AGENT_PIPELINE_ORDER.forEach((agent, i) => {
    record[agent] = [
      {
        version: 2,
        content: `${BASE_PROMPT}\nYou specialise in the ${agent} step of the pipeline.`,
        author: "Priya",
        timestamp: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        active: true,
        evalScore: 78 + (i % 3) * 5,
      },
      {
        version: 3,
        content: `${BASE_PROMPT}\nYou specialise in the ${agent} step of the pipeline.\nNever mention discounts unless asked twice.`,
        author: "Priya",
        timestamp: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
        active: false,
        evalScore: 88 + (i % 3) * 3,
      },
    ]
  })
  return record
}

function getStore(campaignId: string): Record<AgentName, PromptVersion[]> {
  if (!store.has(campaignId)) store.set(campaignId, seedPromptsForCampaign())
  return store.get(campaignId)!
}

export function listPromptVersions(campaignId: string, agent: AgentName): PromptVersion[] {
  return getStore(campaignId)[agent]
}

export function listActivePromptPerAgent(campaignId: string): { agent: AgentName; version: PromptVersion }[] {
  const record = getStore(campaignId)
  return AGENT_PIPELINE_ORDER.map((agent) => ({
    agent,
    version: record[agent].find((v) => v.active) ?? record[agent][0],
  }))
}

/** POST .../versions/:v/activate — versions are append-only, so activating just flips the flag. */
export function activatePromptVersion(campaignId: string, agent: AgentName, version: number): void {
  const versions = getStore(campaignId)[agent]
  versions.forEach((v) => {
    v.active = v.version === version
  })
}

/** Edit always creates a new draft version — never overwrites an existing one. */
export function createDraftPromptVersion(campaignId: string, agent: AgentName, content: string, author: string): PromptVersion {
  const versions = getStore(campaignId)[agent]
  const nextVersion = Math.max(...versions.map((v) => v.version)) + 1
  const draft: PromptVersion = {
    version: nextVersion,
    content,
    author,
    timestamp: new Date().toISOString(),
    active: false,
    evalScore: 0,
  }
  versions.push(draft)
  return draft
}

/** Seeds v1 prompts straight from the New Campaign Wizard instead of the generic defaults. */
export function seedPromptsFromWizard(campaignId: string, owner: string, agentPrompts: Record<AgentName, string>): void {
  const record = {} as Record<AgentName, PromptVersion[]>
  AGENT_PIPELINE_ORDER.forEach((agent) => {
    record[agent] = [
      {
        version: 1,
        content: agentPrompts[agent],
        author: owner,
        timestamp: new Date().toISOString(),
        active: true,
        evalScore: 0,
      },
    ]
  })
  store.set(campaignId, record)
}

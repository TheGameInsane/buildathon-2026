import { AGENT_PIPELINE_ORDER } from "@/types/domain"
import type { Agent } from "@/types/domain"

const store = new Map<string, Agent[]>()

function seedAgents(): Agent[] {
  return AGENT_PIPELINE_ORDER.map((name, i) => ({
    name,
    status: "active",
    lastRunAt: new Date(Date.now() - (i + 1) * 90_000).toISOString(),
    activeVersion: 2 + (i % 2),
    runsToday: 60 - i * 6,
    succeeded: 55 - i * 6,
    failed: i % 3,
    avgCost: 0.002 + i * 0.001,
    avgLatencyMs: 700 + i * 150,
  }))
}

function getStore(campaignId: string): Agent[] {
  if (!store.has(campaignId)) store.set(campaignId, seedAgents())
  return store.get(campaignId)!
}

export function listAgents(campaignId: string): Agent[] {
  return getStore(campaignId)
}

export function setAgentStatus(campaignId: string, agentName: string, status: "active" | "paused"): void {
  const agent = getStore(campaignId).find((a) => a.name === agentName)
  if (agent) agent.status = status
}

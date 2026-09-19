import { delay } from "@/api/delay"
import { listAgents, setAgentStatus } from "@/mocks/agents"
import type { Agent } from "@/types/domain"

/** GET /campaigns/:id/agents (folded into the campaign detail contract) */
export async function fetchAgents(campaignId: string): Promise<Agent[]> {
  await delay()
  return listAgents(campaignId)
}

/** PATCH /campaigns/:id/agents/:agent */
export async function toggleAgentPause(campaignId: string, agent: Agent): Promise<void> {
  await delay()
  setAgentStatus(campaignId, agent.name, agent.status === "active" ? "paused" : "active")
}

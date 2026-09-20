/** Wired to the real backend (`backend/api/agents.py`). */
import { apiFetch } from "@/lib/api-client"
import type { Agent, AgentName } from "@/types/domain"

type BackendAgentKey = "research" | "fitment" | "strategy" | "personalisation" | "conversation" | "follow_up"

const AGENT_LABEL: Record<BackendAgentKey, AgentName> = {
  research: "Research",
  fitment: "ICP Fitment",
  strategy: "Outreach Strategy",
  personalisation: "Personalisation",
  conversation: "Conversation",
  follow_up: "Follow-up",
}

const AGENT_KEY: Record<AgentName, BackendAgentKey> = {
  Research: "research",
  "ICP Fitment": "fitment",
  "Outreach Strategy": "strategy",
  Personalisation: "personalisation",
  Conversation: "conversation",
  "Follow-up": "follow_up",
}

interface BackendAgent {
  agent: BackendAgentKey
  enabled: boolean
  paused: boolean
  active_version: number
  runs_today: number
  succeeded: number
  failed: number
  avg_cost_usd: number
  avg_latency_ms: number
  last_run_at: string | null
}

function toAgent(row: BackendAgent): Agent {
  return {
    name: AGENT_LABEL[row.agent],
    status: row.paused ? "paused" : "active",
    lastRunAt: row.last_run_at,
    activeVersion: row.active_version,
    runsToday: row.runs_today,
    succeeded: row.succeeded,
    failed: row.failed,
    avgCost: row.avg_cost_usd,
    avgLatencyMs: row.avg_latency_ms,
  }
}

/** GET /campaigns/:id/agents */
export async function fetchAgents(campaignId: string): Promise<Agent[]> {
  const rows = await apiFetch<BackendAgent[]>(`/campaigns/${campaignId}/agents`)
  return rows.map(toAgent)
}

/** PATCH /campaigns/:id/agents/:agent */
export async function toggleAgentPause(campaignId: string, agent: Agent): Promise<void> {
  await apiFetch(`/campaigns/${campaignId}/agents/${AGENT_KEY[agent.name]}`, {
    method: "PATCH",
    body: { paused: agent.status === "active" },
  })
}

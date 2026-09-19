import { AGENT_PIPELINE_ORDER } from "@/types/domain"
import type { AgentName } from "@/types/domain"

/** GET /campaigns/defaults?type= — never start a new campaign's agent from a blank prompt. */
export function getDefaultAgentPrompts(): Record<AgentName, string> {
  const record = {} as Record<AgentName, string>
  AGENT_PIPELINE_ORDER.forEach((agent) => {
    record[agent] = `You are an SDR assistant running the ${agent} step of the outreach pipeline.\nUse ONLY facts from the campaign's knowledge base. Never invent a claim.`
  })
  return record
}

/** Default agent prompts has no backend route yet (see docs/api_contract.md's "Not built yet" section) — left on mock data. */
import { delay } from "@/api/delay"
import { getDefaultAgentPrompts } from "@/mocks/prompt-defaults"
import type { AgentName } from "@/types/domain"

/** GET /campaigns/defaults?type= */
export async function fetchDefaultAgentPrompts(): Promise<Record<AgentName, string>> {
  await delay()
  return getDefaultAgentPrompts()
}

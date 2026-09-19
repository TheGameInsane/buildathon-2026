import { delay } from "@/api/delay"
import {
  activatePromptVersion,
  createDraftPromptVersion,
  listActivePromptPerAgent,
  listPromptVersions,
} from "@/mocks/prompts"
import type { AgentName, PromptVersion } from "@/types/domain"

/** GET /campaigns/:id/prompts (thin summary for the Campaign Detail > Prompts tab) */
export async function fetchActivePromptSummary(campaignId: string) {
  await delay()
  return listActivePromptPerAgent(campaignId)
}

/** GET /campaigns/:id/prompts/:agent/versions */
export async function fetchPromptVersions(campaignId: string, agent: AgentName): Promise<PromptVersion[]> {
  await delay()
  return listPromptVersions(campaignId, agent)
}

/** POST /campaigns/:id/prompts/:agent/versions/:v/activate — used for both "Activate" and "Roll back". */
export async function activatePrompt(campaignId: string, agent: AgentName, version: number): Promise<void> {
  await delay()
  activatePromptVersion(campaignId, agent, version)
}

/** POST /campaigns/:id/prompts/:agent/versions — Edit always saves as a new draft version. */
export async function saveDraftPrompt(
  campaignId: string,
  agent: AgentName,
  content: string,
  author: string,
): Promise<PromptVersion> {
  await delay()
  return createDraftPromptVersion(campaignId, agent, content, author)
}

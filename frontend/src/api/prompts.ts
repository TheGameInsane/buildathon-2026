/** Wired to `/campaigns/:id/prompts*` (backend/api/prompts.py + orchestrator/prompts.py)
 * — the actual source of truth. Activating a version here really is the one thing
 * that changes what `orchestrator/step.py` passes into the agent next, there is no
 * separate mock or hardcoded copy anymore.
 */
import { apiFetch } from "@/lib/api-client"
import type { AgentName, PromptVersion } from "@/types/domain"

/** Frontend display name <-> backend agent key (agents/*.py module names). */
const AGENT_KEY: Record<AgentName, string> = {
  Research: "research",
  "ICP Fitment": "fitment",
  "Outreach Strategy": "strategy",
  Personalisation: "personalisation",
  Conversation: "conversation",
  "Follow-up": "follow_up",
}

interface BackendPromptVersion {
  version: number
  content: string
  author: string
  timestamp: string
  active: boolean
  changelog: string
}

function toPromptVersion(row: BackendPromptVersion): PromptVersion {
  return {
    version: row.version,
    content: row.content,
    author: row.author,
    timestamp: row.timestamp,
    active: row.active,
    // Eval scoring isn't wired to prompt versions yet (backend/eval/ runs
    // separately) — 0 renders as "unscored" rather than a fabricated number.
    evalScore: 0,
    changelog: row.changelog,
  }
}

/** GET /campaigns/:id/prompts (thin summary for the Campaign Detail > Prompts tab) */
export async function fetchActivePromptSummary(campaignId: string) {
  const rows = await apiFetch<{ agent: string; version: BackendPromptVersion }[]>(
    `/campaigns/${campaignId}/prompts`,
  )
  const keyToName = Object.fromEntries(
    Object.entries(AGENT_KEY).map(([name, key]) => [key, name as AgentName]),
  )
  return rows
    .filter((r) => keyToName[r.agent])
    .map((r) => ({ agent: keyToName[r.agent], version: toPromptVersion(r.version) }))
}

/** GET /campaigns/:id/prompts/:agent/versions */
export async function fetchPromptVersions(campaignId: string, agent: AgentName): Promise<PromptVersion[]> {
  const rows = await apiFetch<BackendPromptVersion[]>(
    `/campaigns/${campaignId}/prompts/${AGENT_KEY[agent]}/versions`,
  )
  return rows.map(toPromptVersion)
}

/** POST /campaigns/:id/prompts/:agent/versions/:v/activate — used for both "Activate" and "Roll back". */
export async function activatePrompt(campaignId: string, agent: AgentName, version: number): Promise<void> {
  await apiFetch(`/campaigns/${campaignId}/prompts/${AGENT_KEY[agent]}/versions/${version}/activate`, {
    method: "POST",
  })
}

/** POST /campaigns/:id/prompts/:agent/versions — Edit always saves as a new draft version. */
export async function saveDraftPrompt(
  campaignId: string,
  agent: AgentName,
  content: string,
  author: string,
  changelog: string,
): Promise<PromptVersion> {
  const row = await apiFetch<BackendPromptVersion>(
    `/campaigns/${campaignId}/prompts/${AGENT_KEY[agent]}/versions`,
    { method: "POST", body: { content, author, changelog } },
  )
  return toPromptVersion(row)
}

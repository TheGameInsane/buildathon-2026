import { delay } from "@/api/delay"
import { getPlaybook, savePlaybook } from "@/mocks/playbooks"
import type { Playbook, PlaybookRule } from "@/types/domain"

/** GET /campaigns/:id/playbook */
export async function fetchPlaybook(campaignId: string): Promise<Playbook> {
  await delay()
  return getPlaybook(campaignId)
}

/** PUT /campaigns/:id/playbook */
export async function updatePlaybook(campaignId: string, rules: PlaybookRule[]): Promise<void> {
  await delay()
  savePlaybook(campaignId, rules)
}

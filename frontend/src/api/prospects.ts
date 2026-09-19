import { delay } from "@/api/delay"
import { listProspects } from "@/mocks/prospects"
import type { KanbanProspect } from "@/types/domain"

/** GET /campaigns/:id/prospects?stage= */
export async function fetchProspects(campaignId: string): Promise<KanbanProspect[]> {
  await delay()
  return listProspects(campaignId)
}

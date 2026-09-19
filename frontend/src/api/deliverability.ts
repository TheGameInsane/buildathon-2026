import { delay } from "@/api/delay"
import { listMailboxHealth } from "@/mocks/deliverability"
import type { MailboxHealth } from "@/types/domain"

/** GET /campaigns/:id/deliverability */
export async function fetchDeliverability(campaignId: string): Promise<MailboxHealth[]> {
  await delay()
  return listMailboxHealth(campaignId)
}

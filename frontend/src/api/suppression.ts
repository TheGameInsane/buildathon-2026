import { delay } from "@/api/delay"
import { listSuppressionEntries, removeFromSuppression } from "@/mocks/suppression"
import type { SuppressionEntry } from "@/types/domain"

/** GET /suppression-list */
export async function fetchSuppressionEntries(): Promise<SuppressionEntry[]> {
  await delay()
  return listSuppressionEntries()
}

/** DELETE /suppression-list/:id: re-enables outreach to this prospect. */
export async function deleteSuppressionEntry(id: string): Promise<void> {
  await delay()
  removeFromSuppression(id)
}

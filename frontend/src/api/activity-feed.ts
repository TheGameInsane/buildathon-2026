/** The activity feed has no backend route yet (see docs/api_contract.md's "Not built yet" section) — left on mock data. */
import { delay } from "@/api/delay"
import { listActivityFeed } from "@/mocks/activity-feed"
import type { ActivityFeedEvent } from "@/types/domain"

/** GET /activity/feed?since= — swap the body for a real fetch when the backend exists. */
export async function fetchActivityFeed(): Promise<ActivityFeedEvent[]> {
  await delay(100)
  return listActivityFeed()
}
